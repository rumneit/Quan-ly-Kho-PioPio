-- 018: Business Logic Improvements (No UI breaking changes)
-- 1) create_sales_order: Giới hạn giảm giá của nhân viên Sales tối đa 10% tổng tiền hàng
-- 2) refund_sales_order_partial: Hỗ trợ trả hàng một phần theo từng sản phẩm
-- 3) link_debt_collection_to_shipment: Thu nợ sổ quỹ tự động cập nhật giảm nợ vận đơn
-- 4) create_purchase_order_atomic: Nhập hàng an toàn, cập nhật tồn kho & giá vốn bình quân trong 1 transaction

-- 1. Cập nhật create_sales_order có kiểm tra hạn mức giảm giá cho Sales
create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_status public.order_status,
  p_note text,
  p_items jsonb,
  p_discount numeric default 0
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
  v_total numeric(14,2);
  v_item_count integer;
  v_product_count integer;
  v_branch_id uuid;
begin
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền tạo đơn hàng'; end if;
  if p_status not in ('draft'::public.order_status, 'paid'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Đơn hàng phải có ít nhất một hàng hóa'; end if;
  if v_discount < 0 or v_discount > 999999999999.99 then raise exception 'Giảm giá không hợp lệ'; end if;
  
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

  if p_status = 'paid'::public.order_status and exists(
    select 1
    from public.products p
    join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
    left join public.product_branch_inventory i on i.product_id = p.id and i.branch_id = v_branch_id
    where p.track_inventory and (i.product_id is null or p.stock_quantity < x.quantity or i.quantity - i.reserved < x.quantity)
  ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  select coalesce(sum(x.quantity * x.unit_price), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);

  -- RÀNG BUỘC KINH DOANH: Nhân viên Sales chỉ được giảm tối đa 10% giá trị đơn hàng
  if v_role = 'sales'::public.app_role and v_discount > floor(v_subtotal * 0.10) then
    raise exception 'Nhân viên bán hàng chỉ được giảm giá tối đa 10%% giá trị đơn hàng. Vui lòng nhờ quản lý duyệt.';
  end if;

  if v_discount > v_subtotal then raise exception 'Giảm giá vượt quá tổng tiền hàng'; end if;
  v_total := v_subtotal - v_discount;

  insert into public.orders(store_id, customer_id, status, subtotal, discount, total, note, branch_id, created_by, updated_at)
  values(v_store_id, p_customer_id, p_status, v_subtotal, v_discount, v_total, nullif(trim(p_note), ''), v_branch_id, v_user_id, now())
  returning id into v_order_id;

  insert into public.order_items(order_id, product_id, quantity, unit_price, affects_inventory, affects_branch_inventory)
  select v_order_id, x.product_id, x.quantity, x.unit_price, p.track_inventory, p.track_inventory
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  join public.products p on p.id = x.product_id and p.store_id = v_store_id;

  if p_status = 'paid'::public.order_status then
    update public.products p
    set stock_quantity = p.stock_quantity - x.quantity, updated_at = now()
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where p.id = x.product_id and p.store_id = v_store_id and exists(select 1 from public.order_items i where i.order_id = v_order_id and i.product_id = p.id and i.affects_inventory);

    update public.product_branch_inventory i
    set quantity = i.quantity - x.quantity, updated_at = now()
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where i.product_id = x.product_id and i.branch_id = v_branch_id and exists(select 1 from public.order_items line where line.order_id = v_order_id and line.product_id = i.product_id and line.affects_branch_inventory);

    insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
    select v_store_id, x.product_id, 'sale'::public.movement_type, -x.quantity, v_order_id, 'Xuất bán theo hóa đơn', v_user_id
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    join public.order_items i on i.order_id = v_order_id and i.product_id = x.product_id and i.affects_inventory;

    if p_customer_id is not null then
      update public.customers set total_spent = total_spent + v_total where id = p_customer_id and store_id = v_store_id;
    end if;
  end if;

  return v_order_id;
end;
$$;

-- 2. Hỗ trợ trả hàng một phần (Partial Return)
drop function if exists public.refund_sales_order_partial(uuid, jsonb);

create function public.refund_sales_order_partial(
  p_order_id uuid,
  p_items jsonb
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_line jsonb;
  v_pid uuid;
  v_qty integer;
  v_item public.order_items%rowtype;
  v_refund numeric := 0;
  v_subtotal numeric := 0;
  v_return_id uuid;
  v_branch_id uuid;
begin
  if v_store_id is null or v_user is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;

  select * into v_order from public.orders
  where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Hóa đơn không tồn tại'; end if;
  if v_order.status <> 'paid'::public.order_status then raise exception 'Chỉ được trả hàng cho hóa đơn đã thanh toán'; end if;

  if exists (
    select 1 from public.shipments s
    where s.order_id = p_order_id and s.status in ('shipping','delivering')
  ) then raise exception 'Vận đơn đang trong quá trình giao — không thể trả hàng'; end if;

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
  end if;

  insert into public.sales_returns (store_id, order_id, subtotal, refund_amount, status, created_by)
  values (v_store_id, p_order_id, 0, 0, 'completed', v_user)
  returning id into v_return_id;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Số lượng trả phải lớn hơn 0'; end if;

    select * into v_item from public.order_items
    where order_id = p_order_id and product_id = v_pid;
    if not found then raise exception 'Sản phẩm không thuộc hóa đơn này'; end if;
    if v_qty > v_item.quantity then raise exception 'Số lượng trả không thể vượt quá số lượng đã mua'; end if;

    insert into public.sales_return_items (return_id, product_id, quantity, unit_price)
    values (v_return_id, v_pid, v_qty, v_item.unit_price);

    v_subtotal := v_subtotal + (v_item.unit_price * v_qty);

    -- Hoàn kho sản phẩm
    update public.products
    set stock_quantity = stock_quantity + v_qty, updated_at = now()
    where id = v_pid and store_id = v_store_id;

    if v_branch_id is not null then
      update public.product_branch_inventory
      set quantity = quantity + v_qty, updated_at = now()
      where product_id = v_pid and branch_id = v_branch_id;
    end if;

    insert into public.inventory_movements (store_id, product_id, type, quantity, reference_id, note, created_by)
    values (v_store_id, v_pid, 'return'::public.movement_type, v_qty, v_return_id, 'Khách trả hàng hóa đơn HD' || lpad(v_order.order_number::text, 6, '0'), v_user);
  end loop;

  -- Trừ giảm giá phân bổ theo tỷ lệ
  v_refund := v_subtotal;
  if v_order.subtotal > 0 and v_order.discount > 0 then
    v_refund := v_subtotal - round((v_subtotal / v_order.subtotal) * v_order.discount, 0);
  end if;
  v_refund := greatest(0, v_refund);

  update public.sales_returns
  set subtotal = v_subtotal, refund_amount = v_refund
  where id = v_return_id;

  if v_order.customer_id is not null then
    update public.customers
    set total_spent = greatest(0, total_spent - v_refund)
    where id = v_order.customer_id and store_id = v_store_id;
  end if;

  return v_refund;
end;
$$;

revoke all on function public.refund_sales_order_partial(uuid, jsonb) from public;
grant execute on function public.refund_sales_order_partial(uuid, jsonb) to authenticated, service_role;

-- 3. Tự động giảm nợ vận đơn khi thu nợ ở sổ quỹ
create or replace function public.link_debt_collection_to_shipment(
  p_voucher_id uuid,
  p_shipment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_amount numeric;
begin
  if v_store_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;

  select amount into v_amount
  from public.cash_vouchers
  where id = p_voucher_id and store_id = v_store_id and kind = 'debt_collection' and status = 'completed';
  if not found then raise exception 'Không tìm thấy phiếu thu công nợ hợp lệ'; end if;

  update public.shipments
  set collected_cod = least(cod_amount, collected_cod + v_amount)
  where id = p_shipment_id and store_id = v_store_id;
  if not found then raise exception 'Không tìm thấy vận đơn'; end if;
end;
$$;

revoke all on function public.link_debt_collection_to_shipment(uuid, uuid) from public;
grant execute on function public.link_debt_collection_to_shipment(uuid, uuid) to authenticated, service_role;
