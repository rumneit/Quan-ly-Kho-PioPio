-- KiotViet-compatible voucher modules: Stocktakes (Kiểm kho), Internal use (Xuất dùng nội bộ), Damage (Xuất hủy).

create table if not exists public.stocktake_vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  status text not null default 'draft' check (status in ('draft','balanced','cancelled')),
  note text,
  total_actual numeric(14,3) not null default 0,
  total_adjustment numeric(14,3) not null default 0,
  adjustment_value numeric(14,2) not null default 0,
  increase_qty numeric(14,3) not null default 0,
  decrease_qty numeric(14,3) not null default 0,
  actual_count integer not null default 0,
  balanced_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.stocktake_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.stocktake_vouchers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  stock_quantity numeric(14,3) not null default 0,
  actual numeric(14,3) not null default 0,
  diff numeric(14,3) not null default 0
);

create table if not exists public.internal_use_vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  status text not null default 'draft' check (status in ('draft','completed','cancelled')),
  purpose text not null default 'Sử dụng nội bộ',
  receiver text,
  note text,
  total_value numeric(14,2) not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.internal_use_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.internal_use_vouchers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  cost numeric(14,2) not null default 0,
  value numeric(14,2) not null default 0
);

create table if not exists public.damage_vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  status text not null default 'draft' check (status in ('draft','completed','cancelled')),
  note text,
  total_value numeric(14,2) not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.damage_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.damage_vouchers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  cost numeric(14,2) not null default 0,
  value numeric(14,2) not null default 0
);

alter table public.stocktake_vouchers enable row level security;
alter table public.stocktake_lines enable row level security;
alter table public.internal_use_vouchers enable row level security;
alter table public.internal_use_lines enable row level security;
alter table public.damage_vouchers enable row level security;
alter table public.damage_lines enable row level security;

grant select, insert, update, delete on public.stocktake_vouchers, public.stocktake_lines, public.internal_use_vouchers, public.internal_use_lines, public.damage_vouchers, public.damage_lines to authenticated;
grant all on public.stocktake_vouchers, public.stocktake_lines, public.internal_use_vouchers, public.internal_use_lines, public.damage_vouchers, public.damage_lines to service_role;

drop policy if exists "members view stocktakes" on public.stocktake_vouchers;
drop policy if exists "managers manage stocktakes" on public.stocktake_vouchers;
drop policy if exists "members view stocktake lines" on public.stocktake_lines;
drop policy if exists "managers manage stocktake lines" on public.stocktake_lines;
drop policy if exists "members view internal use" on public.internal_use_vouchers;
drop policy if exists "managers manage internal use" on public.internal_use_vouchers;
drop policy if exists "members view internal use lines" on public.internal_use_lines;
drop policy if exists "managers manage internal use lines" on public.internal_use_lines;
drop policy if exists "members view damages" on public.damage_vouchers;
drop policy if exists "managers manage damages" on public.damage_vouchers;
drop policy if exists "members view damage lines" on public.damage_lines;
drop policy if exists "managers manage damage lines" on public.damage_lines;

create policy "members view stocktakes" on public.stocktake_vouchers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage stocktakes" on public.stocktake_vouchers for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view stocktake lines" on public.stocktake_lines for select to authenticated using (exists(select 1 from public.stocktake_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id())));
create policy "managers manage stocktake lines" on public.stocktake_lines for all to authenticated using (exists(select 1 from public.stocktake_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.stocktake_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));

create policy "members view internal use" on public.internal_use_vouchers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage internal use" on public.internal_use_vouchers for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view internal use lines" on public.internal_use_lines for select to authenticated using (exists(select 1 from public.internal_use_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id())));
create policy "managers manage internal use lines" on public.internal_use_lines for all to authenticated using (exists(select 1 from public.internal_use_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.internal_use_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));

create policy "members view damages" on public.damage_vouchers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage damages" on public.damage_vouchers for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view damage lines" on public.damage_lines for select to authenticated using (exists(select 1 from public.damage_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id())));
create policy "managers manage damage lines" on public.damage_lines for all to authenticated using (exists(select 1 from public.damage_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.damage_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));
