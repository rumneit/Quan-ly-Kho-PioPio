-- =====================================================================
-- 011_data_deletion.sql — transactional, store-scoped data deletion
-- Used by Settings → Xóa dữ liệu. Password check happens in the app
-- (Supabase Auth) BEFORE calling these; functions re-verify manager role.
-- These ONLY delete the current manager's store data (strict scope),
-- never cross-tenant, never touch users/branches/settings/audit.
-- =====================================================================

-- Delete transactions + cash flow for a store (keep master data)
create or replace function public.delete_store_transactions(p_store_id uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền thực hiện thao tác này'; end if;
  if p_store_id is distinct from public.current_store_id() then raise exception 'Cửa hàng không hợp lệ'; end if;

  delete from public.order_items where order_id in (select id from public.orders where store_id = p_store_id);
  delete from public.sales_return_items where return_id in (select id from public.sales_returns where store_id = p_store_id);
  delete from public.sales_returns where store_id = p_store_id;
  delete from public.shipment_status_history where shipment_id in (select id from public.shipments where store_id = p_store_id);
  delete from public.shipments where store_id = p_store_id;
  delete from public.cash_vouchers where store_id = p_store_id;
  delete from public.inventory_movements where store_id = p_store_id;
  delete from public.orders where store_id = p_store_id;

  update public.customers set total_spent = 0 where store_id = p_store_id;
  return 1;
end;
$$;

-- Delete ALL store data (transactions + master data), keep users/branches/settings
create or replace function public.delete_store_all_data(p_store_id uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền thực hiện thao tác này'; end if;
  if p_store_id is distinct from public.current_store_id() then raise exception 'Cửa hàng không hợp lệ'; end if;

  perform public.delete_store_transactions(p_store_id);

  delete from public.purchase_return_lines where voucher_id in (select id from public.purchase_return_vouchers where store_id = p_store_id);
  delete from public.purchase_return_vouchers where store_id = p_store_id;
  delete from public.purchase_lines where voucher_id in (select id from public.purchase_vouchers where store_id = p_store_id);
  delete from public.purchase_vouchers where store_id = p_store_id;
  delete from public.product_branch_inventory where store_id = p_store_id;
  delete from public.product_components where product_id in (select id from public.products where store_id = p_store_id) or component_id in (select id from public.products where store_id = p_store_id);
  delete from public.user_product_group_permissions where store_id = p_store_id;
  delete from public.products where store_id = p_store_id;
  delete from public.customers where store_id = p_store_id;
  delete from public.suppliers where store_id = p_store_id;
  delete from public.delivery_partners where store_id = p_store_id;
  delete from public.shipments where store_id = p_store_id;
  return 1;
end;
$$;

revoke all on function public.delete_store_transactions(uuid) from public;
revoke all on function public.delete_store_all_data(uuid) from public;
grant execute on function public.delete_store_transactions(uuid) to authenticated, service_role;
grant execute on function public.delete_store_all_data(uuid) to authenticated, service_role;