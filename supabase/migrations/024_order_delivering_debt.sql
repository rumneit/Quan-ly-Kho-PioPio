-- 024_order_delivering_debt: Luong don "Dang giao" -> "Cong no / Da thanh toan TM" (Hoan thanh)
-- YEU CAU: da chay 023_order_delivering_enum.sql truoc do.
-- Gom:
--   1) Cot public.customers.debt (no khach, chi ham SECURITY DEFINER duoc ghi)
--   2) create_sales_order: cho phep tao don 'delivering' (tru ton kho ngay, chua tinh tong ban)
--   3) transition_sales_order: draft->delivering|paid|cancelled, delivering->paid|cancelled
--      paid tu delivering kem p_payment_method ('cash' | 'debt'), cong no khach khi 'debt'
--   4) customers_by_debt: tinh them no tren don (c.debt)
--   5) collect_customer_debt: thu no khach (tru c.debt)
--   6) cashbook_cancel_voucher: huy phieu thu cong no thi hoan lai no khach

-- ============ 1) Cot no khach ============
alter table public.customers add column if not exists debt numeric(14,2) not null default 0;

-- ============ 2) create_sales_order ============
drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb);
drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb, numeric);

create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_status public.order_status,
  p_note text,
  p_items jsonb,
  p_discount numeric default 0,
  p_discount_percent numeric default 0,
  p_vat_percent numeric default 0,
  p_ship_fee numeric default 0
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_order_id uuid;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2) := coalesce(p_discount, 0);
  v_vat numeric(14,2) := 0;
  v_ship numeric(14,2) := coalesce(p_ship_fee, 0);
  v_total numeric(14,2);
  v_item_count integer;
  v_product_count integer;
  v_branch_id uuid;
begin
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền tạo đơn hàng'; end if;
  if p_status not in ('draft'::public.order_status, 'delivering'::public.order_status, 'paid'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Đơn hàng phải có ít nhất một hàng hóa'; end if;
  if v_discount < 0 or v_discount > 999999999999.99 then raise exception 'Giảm giá không hợp lệ'; end if;
  if p_discount_percent < 0 or p_discount_percent > 100 or p_vat_percent < 0 or p_vat_percent > 100 then raise exception 'Phần trăm chiết khấu/VAT không hợp lệ'; end if;
  if v_ship < 0 or v_ship > 999999999999.99 then raise exception 'Phí ship không hợp lệ'; end if;

  select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
  if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;

  if p_customer_id is not null and not exists(select 1 from public.customers c where c.id = p_customer_id and c.store_id = v_store_id) then
    raise exception 'Khách hàng không thuộc cửa hàng';
  end if;

  if exists(
    select 1 from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where x.product_id is null or x.quantity is null or x.quantity <= 0 or x.unit_price is null or x.unit_price not between 0 and 999999999999.99
  ) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;

  select count(*), count(distinct x.product_id) into v_item_count, v_product_count
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);
  if v_item_count <> v_product_count then raise exception 'Mỗi hàng hóa chỉ được xuất hiện một lần'; end if;

  perform p.id
  from public.products p
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
  where p.store_id = v_store_id and p.active = true
  for update of p;

  select count(*) into v_product_count
  from public.products p
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
  where p.store_id = v_store_id and p.active = true;
  if v_product_count <> v_item_count then raise exception 'Có hàng hóa không tồn tại hoặc không còn kinh doanh'; end if;

  if exists(
    select 1 from public.products p
    join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
    where p.store_id = v_store_id and p.sold_by <> 'quantity'
  ) then raise exception 'Đơn hàng hiện chỉ hỗ trợ hàng hóa bán theo số lượng nguyên'; end if;

  perform i.product_id from public.product_branch_inventory i
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = i.product_id
  where i.branch_id = v_branch_id for update of i;

  if p_status in ('delivering'::public.order_status, 'paid'::public.order_status)
    and not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from public.products p
      join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
      left join public.product_branch_inventory i on i.product_id = p.id and i.branch_id = v_branch_id
      where p.track_inventory and (i.product_id is null or p.stock_quantity < x.quantity or i.quantity - i.reserved < x.quantity)
    ) then raise exception 'Tồn kho không đủ để giao hàng'; end if;

  select coalesce(sum(x.quantity * x.unit_price), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);

  if v_role = 'sales'::public.app_role and v_discount > floor(v_subtotal * 0.10) then
    raise exception 'Nhân viên bán hàng chỉ được giảm giá tối đa 10%% giá trị đơn hàng. Vui lòng nhờ quản lý duyệt.';
  end if;
  if v_discount > v_subtotal then raise exception 'Giảm giá vượt quá tổng tiền hàng'; end if;
  v_vat := round(v_subtotal * coalesce(p_vat_percent, 0) / 100);
  v_total := v_subtotal - v_discount + v_vat + v_ship;

  insert into public.orders(store_id, customer_id, status, subtotal, discount, discount_percent, vat_percent, vat_amount, ship_fee, total, note, branch_id, created_by, updated_at)
  values(v_store_id, p_customer_id, p_status, v_subtotal, v_discount, coalesce(p_discount_percent, 0), coalesce(p_vat_percent, 0), v_vat, v_ship, v_total, nullif(trim(p_note), ''), v_branch_id, v_user_id, now())
  returning id into v_order_id;

  insert into public.order_items(order_id, product_id, quantity, unit_price, affects_inventory, affects_branch_inventory)
  select v_order_id, x.product_id, x.quantity, x.unit_price, p.track_inventory, p.track_inventory
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  join public.products p on p.id = x.product_id and p.store_id = v_store_id;

  -- Hang da roi kho khi tao don dang giao hoac hoan thanh: tru ton ngay.
  -- Rieng doanh thu (total_spent) chi tinh khi da hoan thanh (paid).
  if p_status in ('delivering'::public.order_status, 'paid'::public.order_status) then
    update public.products p
    set stock_quantity = p.stock_quantity - x.quantity, updated_at = now()
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where p.id = x.product_id and p.store_id = v_store_id and exists(select 1 from public.order_items i where i.order_id = v_order_id and i.product_id = p.id and i.affects_inventory);

    update public.product_branch_inventory i
    set quantity = i.quantity - x.quantity, updated_at = now()
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where i.product_id = x.product_id and i.branch_id = v_branch_id and exists(select 1 from public.order_items line where line.order_id = v_order_id and line.product_id = i.product_id and line.affects_branch_inventory);

    insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
    select v_store_id, x.product_id, 'sale'::public.movement_type, -x.quantity, v_order_id, 'Xuất kho theo đơn hàng', v_user_id
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    join public.order_items i on i.order_id = v_order_id and i.product_id = x.product_id and i.affects_inventory;

    if p_status = 'paid'::public.order_status and p_customer_id is not null then
      update public.customers set total_spent = total_spent + v_total where id = p_customer_id and store_id = v_store_id;
    end if;
  end if;

  return v_order_id;
end;
$$;

-- ============ 3) transition_sales_order ============
drop function if exists public.transition_sales_order(uuid, public.order_status);

create function public.transition_sales_order(p_order_id uuid, p_status public.order_status, p_payment_method text default null) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_order public.orders%rowtype;
  v_branch_id uuid;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('delivering'::public.order_status, 'paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'debt', 'transfer') then raise exception 'Phương thức thanh toán không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;

  -- Huy PHIEU TAM: khong anh huong ton kho
  if p_status = 'cancelled'::public.order_status and v_order.status = 'draft'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;

  -- Huy DON DANG GIAO: hoan ton kho da xuat
  if p_status = 'cancelled'::public.order_status and v_order.status = 'delivering'::public.order_status then
    v_branch_id := v_order.branch_id;
    if v_branch_id is null then
      select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    end if;
    update public.products p
    set stock_quantity = p.stock_quantity + sold.quantity, updated_at = now()
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
    where p.id = sold.product_id and p.store_id = v_store_id;
    if v_branch_id is not null then
      update public.product_branch_inventory inventory
      set quantity = inventory.quantity + sold.quantity, updated_at = now()
      from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
      where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
    end if;
    insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
    select v_store_id, sold.product_id, 'return'::public.movement_type, sold.quantity, p_order_id, 'Hoàn tồn khi hủy đơn giao ' || lpad(v_order.order_number::text, 6, '0'), v_user_id
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;

  if p_status = 'cancelled'::public.order_status then raise exception 'Chỉ phiếu tạm hoặc đơn đang giao mới được hủy'; end if;

  -- HOAN THANH tu DON DANG GIAO: ton kho da tru tu luc tao don, chi ghi nhan doanh thu + cong no
  if p_status = 'paid'::public.order_status and v_order.status = 'delivering'::public.order_status then
    if p_payment_method = 'debt' and v_order.customer_id is null then raise exception 'Cần chọn khách hàng để ghi công nợ'; end if;
    if v_order.customer_id is not null then
      update public.customers set total_spent = total_spent + v_order.total where id = v_order.customer_id and store_id = v_store_id;
      if p_payment_method = 'debt' then
        update public.customers set debt = debt + v_order.total where id = v_order.customer_id and store_id = v_store_id;
      end if;
    end if;
    update public.orders set status = 'paid'::public.order_status, payment_method = coalesce(p_payment_method, payment_method), updated_at = now() where id = p_order_id;
    return;
  end if;

  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm hoặc đơn đang giao mới được cập nhật'; end if;

  -- Tu PHIEU TAM -> delivering hoac paid: tru ton kho tai day
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if v_order.customer_id is null and p_status = 'paid'::public.order_status and p_payment_method = 'debt' then raise exception 'Cần chọn khách hàng để ghi công nợ'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;
  v_discount := coalesce(v_order.discount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Giảm giá không hợp lệ'; end if;
  v_total := v_subtotal - v_discount + coalesce(v_order.vat_amount, 0) + coalesce(v_order.ship_fee, 0);

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
      join public.products p on p.id = sold.product_id and p.store_id = v_store_id
      left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
      where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
    ) then raise exception 'Tồn kho không đủ để giao hàng'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất kho theo đơn hàng', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;

  if p_status = 'paid'::public.order_status and v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = v_order.customer_id and store_id = v_store_id;
    if p_payment_method = 'debt' then
      update public.customers set debt = debt + v_total where id = v_order.customer_id and store_id = v_store_id;
    end if;
  end if;
  update public.orders set status = p_status, subtotal = v_subtotal, discount = v_discount, total = v_total, branch_id = v_branch_id, payment_method = coalesce(p_payment_method, payment_method), updated_at = now() where id = p_order_id;
end;
$$;

-- ============ 4) customers_by_debt: tinh them no tren don ============
drop function if exists public.customers_by_debt(numeric, numeric);

create function public.customers_by_debt(p_min numeric, p_max numeric)
returns table(customer_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id as customer_id
  from public.customers c
  left join (
    select o.customer_id, sum(greatest(0, s.cod_amount - s.collected_cod)) as cod_debt
    from public.orders o
    join public.shipments s on s.order_id = o.id and s.status <> 'cancelled'
    where o.status not in ('draft', 'cancelled', 'refunded')
    group by o.customer_id
  ) d on d.customer_id = c.id
  where coalesce(d.cod_debt, 0) + coalesce(c.debt, 0)
        between coalesce(p_min, -1e12) and coalesce(p_max, 1e12)
$$;

-- ============ 5) collect_customer_debt: thu no khach ============
create or replace function public.collect_customer_debt(p_customer_id uuid, p_amount numeric) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền thu công nợ'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 then raise exception 'Số tiền thu không hợp lệ'; end if;
  update public.customers set debt = debt - p_amount where id = p_customer_id and store_id = v_store_id;
  if not found then raise exception 'Không tìm thấy khách hàng'; end if;
end;
$$;

-- ============ 6) cashbook_cancel_voucher: hoan no khi huy phieu thu cong no ============
create or replace function public.cashbook_cancel_voucher(p_voucher_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_voucher public.cash_vouchers%rowtype;
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền hủy phiếu'; end if;
  select * into v_voucher from public.cash_vouchers where id = p_voucher_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy phiếu'; end if;
  if v_voucher.status <> 'completed' then raise exception 'Chỉ phiếu chưa hủy mới được hủy'; end if;
  if v_voucher.type = 'receipt' and v_voucher.kind = 'debt_collection' and v_voucher.partner_kind = 'customer' and v_voucher.partner_id is not null then
    update public.customers set debt = debt + v_voucher.amount where id = v_voucher.partner_id and store_id = v_store_id;
  end if;
  update public.cash_vouchers
  set status = 'cancelled', cancelled_by = v_user_id, cancelled_at = now(), updated_at = now()
  where id = p_voucher_id and store_id = v_store_id;
end;
$$;

-- ============ Grants ============
revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric, numeric, numeric, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric, numeric, numeric, numeric) to authenticated, service_role;
revoke all on function public.transition_sales_order(uuid, public.order_status, text) from public;
grant execute on function public.transition_sales_order(uuid, public.order_status, text) to authenticated, service_role;
revoke all on function public.customers_by_debt(numeric, numeric) from public;
grant execute on function public.customers_by_debt(numeric, numeric) to authenticated, service_role;
revoke all on function public.collect_customer_debt(uuid, numeric) from public;
grant execute on function public.collect_customer_debt(uuid, numeric) to authenticated, service_role;
revoke all on function public.cashbook_cancel_voucher(uuid) from public;
grant execute on function public.cashbook_cancel_voucher(uuid) to authenticated, service_role;
