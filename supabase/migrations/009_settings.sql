-- =====================================================================
-- 009_settings.sql — Complete settings system for PioPio
-- Adds: store_settings, user_product_group_permissions, audit_log,
--       book_periods, print_templates, devices
-- Idempotent and RLS-safe. Safe to apply on top of 001-008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- store_settings — per-store configuration (costing, inventory, etc.)
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  cost_method text not null default 'average' check (cost_method in ('fixed','average')),
  track_lot_expiry boolean not null default false,
  manufacturing_enabled boolean not null default false,
  allow_change_transaction_time boolean not null default false,
  allow_negative_stock boolean not null default false,
  working_time_band smallint not null default 1 check (working_time_band between 0 and 3),
  currency text not null default 'VND',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

grant select, insert, update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;

drop policy if exists "managers manage store settings" on public.store_settings;
drop policy if exists "members view store settings" on public.store_settings;
create policy "managers manage store settings" on public.store_settings for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view store settings" on public.store_settings for select to authenticated
  using (store_id = (select public.current_store_id()));

-- Seed defaults for existing stores
insert into public.store_settings(store_id)
select s.id from public.stores s
where not exists(select 1 from public.store_settings ss where ss.store_id = s.id);
-- ---------------------------------------------------------------------
-- user_product_group_permissions — granular access by product group
-- ---------------------------------------------------------------------
create table if not exists public.user_product_group_permissions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  unique (user_id, category_id)
);
create index if not exists upgp_user_idx on public.user_product_group_permissions(user_id);
create index if not exists upgp_category_idx on public.user_product_group_permissions(category_id);
grant select, insert, delete on public.user_product_group_permissions to authenticated;
grant all on public.user_product_group_permissions to service_role;
alter table public.user_product_group_permissions enable row level security;
drop policy if exists "managers manage permissions" on public.user_product_group_permissions;
create policy "managers manage permissions" on public.user_product_group_permissions for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- ---------------------------------------------------------------------
-- audit_log — record of significant admin actions
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_store_created_idx on public.audit_log(store_id, created_at desc);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
drop policy if exists "managers view audit log" on public.audit_log;
create policy "managers view audit log" on public.audit_log for select to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- ---------------------------------------------------------------------
-- book_periods — locked accounting periods (prevents back-dating)
-- ---------------------------------------------------------------------
create table if not exists public.book_periods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  locked_at timestamptz not null default now(),
  locked_by uuid not null references public.profiles(id),
  note text,
  unique (store_id, period_start, period_end),
  check (period_end >= period_start)
);
create index if not exists book_periods_store_idx on public.book_periods(store_id, period_end desc);
grant select, insert, delete on public.book_periods to authenticated;
grant all on public.book_periods to service_role;
alter table public.book_periods enable row level security;
drop policy if exists "managers manage book periods" on public.book_periods;
create policy "managers manage book periods" on public.book_periods for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- ---------------------------------------------------------------------
-- print_templates — template metadata for invoices/orders
-- ---------------------------------------------------------------------
create table if not exists public.print_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  type text not null check (type in ('invoice','order','return','purchase','stocktake')),
  name text not null,
  paper_size text not null default 'A4' check (paper_size in ('A4','A5','80mm','K80')),
  copies smallint not null default 1 check (copies between 1 and 9),
  show_logo boolean not null default true,
  show_store_info boolean not null default true,
  show_tax boolean not null default true,
  footer_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, type, name)
);
grant select, insert, update, delete on public.print_templates to authenticated;
grant all on public.print_templates to service_role;
alter table public.print_templates enable row level security;
drop policy if exists "managers manage print templates" on public.print_templates;
create policy "managers manage print templates" on public.print_templates for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- ---------------------------------------------------------------------
-- devices — paired devices (scanner, printer, scale)
-- ---------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('scanner','printer','scale','pos','other')),
  identifier text not null,
  paired_by uuid not null references public.profiles(id),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  active boolean not null default true
);
create index if not exists devices_store_idx on public.devices(store_id);
grant select, insert, update, delete on public.devices to authenticated;
grant all on public.devices to service_role;
alter table public.devices enable row level security;
drop policy if exists "managers manage devices" on public.devices;
create policy "managers manage devices" on public.devices for all to authenticated
  using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')
  with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
