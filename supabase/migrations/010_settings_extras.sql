-- =====================================================================
-- 010_settings_extras.sql — API tokens + currency exchange rates
-- Safe to apply on top of 001-009.
-- =====================================================================

-- ---------------------------------------------------------------------
-- api_tokens — API integration credentials (token shown once at create)
-- ---------------------------------------------------------------------
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  scopes text not null default 'read' check (scopes in ('read','read_write')),
  token_hash text not null,
  token_prefix text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true
);
create index if not exists api_tokens_store_idx on public.api_tokens(store_id, created_at desc);
grant select, insert, update, delete on public.api_tokens to authenticated;
grant all on public.api_tokens to service_role;
alter table public.api_tokens enable row level security;
drop policy if exists "managers manage api tokens" on public.api_tokens;
create policy "managers manage api tokens" on public.api_tokens for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- ---------------------------------------------------------------------
-- currency_exchange_rates — exchange rate relative to base currency (VND)
-- ---------------------------------------------------------------------
create table if not exists public.currency_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  currency text not null,
  rate numeric(14,4) not null default 1 check (rate > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (store_id, currency)
);
grant select, insert, update, delete on public.currency_exchange_rates to authenticated;
grant all on public.currency_exchange_rates to service_role;
alter table public.currency_exchange_rates enable row level security;
drop policy if exists "managers manage exchange rates" on public.currency_exchange_rates;
create policy "managers manage exchange rates" on public.currency_exchange_rates for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- Seed default VND rate for existing stores
insert into public.currency_exchange_rates(store_id, currency, rate)
select s.id, 'VND', 1 from public.stores s
where not exists(select 1 from public.currency_exchange_rates r where r.store_id = s.id and r.currency = 'VND');