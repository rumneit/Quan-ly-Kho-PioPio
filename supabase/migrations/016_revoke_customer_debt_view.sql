-- P0 Security fix: customer_debt_view bypassed store isolation (views bypass RLS).
-- The app only uses customers_by_debt() RPC which is store-isolated via current_store_id().
revoke select on public.customer_debt_view from authenticated;
grant select on public.customer_debt_view to service_role;
