-- P0 fixes for Customers and Cashbook
-- Customers: debt calculation corrected, injection prevention via helper (app code), store isolation
-- Cashbook: opening balance when filtering by date, injection fix (app code), fund isolation

-- Fix cashbook_summary: opening must include voucher movements before p_from
create or replace function public.cashbook_summary(
  p_account_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
) returns table(opening numeric, total_receipt numeric, total_expense numeric)
language sql
security definer
set search_path = ''
as $$
  with accounts as (
    select a.id, a.opening_balance
    from public.cash_accounts a
    where a.store_id = public.current_store_id()
      and (p_account_ids is null or a.id = any(p_account_ids))
  ), before_movements as (
    select v.type, v.amount
    from public.cash_vouchers v
    join accounts a on a.id = v.account_id
    where v.status = 'completed'
      and p_from is not null
      and v.occurred_at < p_from
  ), movements as (
    select v.type, v.amount
    from public.cash_vouchers v
    join accounts a on a.id = v.account_id
    where v.status = 'completed'
      and (p_from is null or v.occurred_at >= p_from)
      and (p_to is null or v.occurred_at <= p_to)
  )
  select
    coalesce((select sum(a.opening_balance) from accounts a), 0)
      + coalesce((select sum(case when b.type = 'receipt' then b.amount else -b.amount end) from before_movements b), 0),
    coalesce((select sum(m.amount) from movements m where m.type = 'receipt'), 0),
    coalesce((select sum(m.amount) from movements m where m.type = 'expense'), 0);
$$;

revoke all on function public.cashbook_summary(uuid[], timestamptz, timestamptz) from public;
grant execute on function public.cashbook_summary(uuid[], timestamptz, timestamptz) to authenticated, service_role;

-- Helper RPC for customer debt filter to avoid fetching all shipments (store-isolated, status-correct)
create or replace function public.customers_by_debt(
  p_min numeric,
  p_max numeric
) returns table(customer_id uuid)
language sql
security definer
set search_path = ''
as $$
  with debt as (
    select
      c.id as customer_id,
      coalesce(sum(greatest(0, s.cod_amount - s.collected_cod)), 0) as debt
    from public.customers c
    left join public.orders o on o.customer_id = c.id and o.store_id = c.store_id and o.status not in ('draft','cancelled')
    left join public.shipments s on s.order_id = o.id and s.store_id = c.store_id and s.status <> 'cancelled'
    where c.store_id = public.current_store_id()
    group by c.id
  )
  select customer_id from debt
  where (p_min is null or debt >= p_min)
    and (p_max is null or debt <= p_max);
$$;

revoke all on function public.customers_by_debt(numeric, numeric) from public;
grant execute on function public.customers_by_debt(numeric, numeric) to authenticated, service_role;

-- Optional view for debugging / future use: customer debt per store (status-correct)
create or replace view public.customer_debt_view as
select
  c.id as customer_id,
  c.store_id,
  coalesce(sum(greatest(0, s.cod_amount - s.collected_cod)), 0) as debt
from public.customers c
left join public.orders o on o.customer_id = c.id and o.store_id = c.store_id and o.status not in ('draft','cancelled')
left join public.shipments s on s.order_id = o.id and s.store_id = c.store_id and s.status <> 'cancelled'
group by c.id, c.store_id;

grant select on public.customer_debt_view to authenticated, service_role;
