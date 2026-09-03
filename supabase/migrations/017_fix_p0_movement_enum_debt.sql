-- 017: P0 fix — enum movement_type thiếu giá trị mà app đang insert
-- (purchase_return, damage, internal_use) khiến mọi phiếu trả hàng nhập /
-- xuất hủy / xuất nội bộ GHI LỊCH SỬ KHO THẤT BẠI.
-- Chạy standalone (ALTER TYPE ADD VALUE không được nằm trong transaction block).

alter type public.movement_type add value if not exists 'purchase_return';
alter type public.movement_type add value if not exists 'damage';
alter type public.movement_type add value if not exists 'internal_use';

-- P1: đơn refunded không được tính là nợ khách (customers_by_debt)
create or replace function public.customers_by_debt(p_min numeric, p_max numeric)
returns table (customer_id uuid, debt numeric)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id,
         coalesce(sum(greatest(0, s.cod_amount - s.collected_cod)), 0) as debt
  from public.customers c
  left join public.orders o
    on o.customer_id = c.id
   and o.store_id = c.store_id
   and o.status not in ('draft', 'cancelled', 'refunded')
  left join public.shipments s
    on s.order_id = o.id
   and s.status <> 'cancelled'
  group by c.id
  having coalesce(sum(greatest(0, s.cod_amount - s.collected_cod)), 0) between coalesce(p_min, -1e12) and coalesce(p_max, 1e12)
$$;

revoke all on function public.customers_by_debt(numeric, numeric) from public;
grant execute on function public.customers_by_debt(numeric, numeric) to authenticated, service_role;

-- P1: index cho join công nợ theo khách hàng
create index if not exists orders_customer_idx on public.orders(customer_id);
