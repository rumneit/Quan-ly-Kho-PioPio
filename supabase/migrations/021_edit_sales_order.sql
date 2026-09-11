-- 021_edit_sales_order: Chỉnh sửa hóa đơn đã thanh toán
-- Hoàn tồn theo items cũ -> thay bằng items mới -> trừ tồn mới, cập nhật tiền khách, mọi thứ trong 1 transaction.

create or replace function public.edit_sales_order(
  p_order_id uuid,
  p_customer_id uuid,
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
  v_order public.orders%rowtype;
  v_branch_id uuid;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2) := coalesce(p_discount, 0);
  v_total numeric(14,2);
  v_item_count integer;
  v_product_count integer;
  v_old_customer_id uuid;
begin
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền chỉnh sửa hóa đơn'; end if;

  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy hóa đơn'; end if;
  if v_order.status <> 'paid'::public.order_status then raise exception 'Chỉ hóa đơn đã thanh toán mới được chỉnh sửa'; end if;

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
  end if;
  if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;

  if p_customer_id is not null and not exists(select 1 from public.customers c where c.id = p_customer_id and c.store_id = v_store_id) then
    raise exception 'Khách hàng không thuộc cửa hàng';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Hóa đơn phải có ít nhất một hàng hóa'; end if;
  if v_discount < 0 or v_discount > 999999999999.99 then raise exception 'Giảm giá không hợp lệ'; end if;
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
  ) then raise exception 'Hóa đơn hiện chỉ hỗ trợ hàng hóa bán theo số lượng nguyên'; end if;

  perform i.product_id from public.product_branch_inventory i
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = i.product_id
  where i.branch_id = v_branch_id for update of i;

  -- 1) HOÀN TỒN kho theo items CŨ
  update public.products p
  set stock_quantity = p.stock_quantity + sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory i
  set quantity = i.quantity + sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where i.product_id = sold.product_id and i.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'return'::public.movement_type, sold.quantity, p_order_id, 'Hoàn tồn khi sửa hóa đơn HD' || lpad(v_order.order_number::text, 6, '0'), v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;

  -- 2) Kiểm tra tồn kho cho items MỚI (tôn trọng allow_negative_stock)
  if not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from public.products p
      join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
      left join public.product_branch_inventory i on i.product_id = p.id and i.branch_id = v_branch_id
      where p.track_inventory and (i.product_id is null or p.stock_quantity < x.quantity or i.quantity - i.reserved < x.quantity)
    ) then raise exception 'Tồn kho không đủ để cập nhật hóa đơn'; end if;

  -- 3) Thay items
  delete from public.order_items where order_id = p_order_id;
  insert into public.order_items(order_id, product_id, quantity, unit_price, affects_inventory, affects_branch_inventory)
  select p_order_id, x.product_id, x.quantity, x.unit_price, p.track_inventory, p.track_inventory
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  join public.products p on p.id = x.product_id and p.store_id = v_store_id;

  select coalesce(sum(x.quantity * x.unit_price), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);
  if v_role = 'sales'::public.app_role and v_discount > floor(v_subtotal * 0.10) then
    raise exception 'Nhân viên bán hàng chỉ được giảm giá tối đa 10%% giá trị đơn hàng. Vui lòng nhờ quản lý duyệt.';
  end if;
  if v_discount > v_subtotal then raise exception 'Giảm giá vượt quá tổng tiền hàng'; end if;
  v_total := v_subtotal - v_discount;

  -- 4) Trừ tồn theo items MỚI
  update public.products p
  set stock_quantity = p.stock_quantity - x.quantity, updated_at = now()
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  where p.id = x.product_id and p.store_id = v_store_id and exists(select 1 from public.order_items i where i.order_id = p_order_id and i.product_id = p.id and i.affects_inventory);
  update public.product_branch_inventory i
  set quantity = i.quantity - x.quantity, updated_at = now()
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  where i.product_id = x.product_id and i.branch_id = v_branch_id and exists(select 1 from public.order_items line where line.order_id = p_order_id and line.product_id = i.product_id and line.affects_branch_inventory);
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, x.product_id, 'sale'::public.movement_type, -x.quantity, p_order_id, 'Xuất lại theo hóa đơn đã sửa HD' || lpad(v_order.order_number::text, 6, '0'), v_user_id
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  join public.order_items i on i.order_id = p_order_id and i.product_id = x.product_id and i.affects_inventory;

  -- 5) Điều chỉnh tổng mua khách (trừ tổng cũ, cộng tổng mới)
  v_old_customer_id := v_order.customer_id;
  if v_old_customer_id is not null then
    update public.customers set total_spent = total_spent - v_order.total where id = v_old_customer_id and store_id = v_store_id;
  end if;
  if p_customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = p_customer_id and store_id = v_store_id;
  end if;

  -- 6) Cập nhật hóa đơn
  update public.orders
  set customer_id = p_customer_id, note = nullif(trim(p_note), ''), discount = v_discount, subtotal = v_subtotal, total = v_total, updated_at = now()
  where id = p_order_id;

  return p_order_id;
end;
$$;

revoke all on function public.edit_sales_order(uuid, uuid, text, jsonb, numeric) from public;
grant execute on function public.edit_sales_order(uuid, uuid, text, jsonb, numeric) to authenticated, service_role;
