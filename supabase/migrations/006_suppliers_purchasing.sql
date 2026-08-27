-- KiotViet-compatible Suppliers + Purchasing (Nhập hàng / Trả hàng nhập) modules.

alter table public.suppliers add column if not exists code text;
alter table public.suppliers add column if not exists phone text;
alter table public.suppliers add column if not exists email text;
alter table public.suppliers add column if not exists address text;
alter table public.suppliers add column if not exists area text;
alter table public.suppliers add column if not exists ward text;
alter table public.suppliers add column if not exists group_name text;
alter table public.suppliers add column if not exists company text;
alter table public.suppliers add column if not exists tax_code text;
alter table public.suppliers add column if not exists identity text;
alter table public.suppliers add column if not exists note text;
alter table public.suppliers add column if not exists active boolean not null default true;
alter table public.suppliers add column if not exists created_by uuid references public.profiles(id);

create unique index if not exists suppliers_store_code_uq on public.suppliers(store_id, code) where code is not null and code <> '';

create table if not exists public.purchase_vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  status text not null default 'draft' check (status in ('draft','completed','cancelled')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  branch text,
  handler text,
  invoice_number text,
  note text,
  total_qty numeric(14,3) not null default 0,
  item_count integer not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  payable numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.purchase_vouchers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  cost numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  value numeric(14,2) not null default 0
);

create table if not exists public.purchase_return_vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  status text not null default 'draft' check (status in ('draft','completed','cancelled')),
  purchase_id uuid references public.purchase_vouchers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  branch text,
  handler text,
  note text,
  total_qty numeric(14,3) not null default 0,
  item_count integer not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  payable numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  refund_type text not null default 'debt' check (refund_type in ('cash','debt')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.purchase_return_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.purchase_return_vouchers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  cost numeric(14,2) not null default 0,
  return_price numeric(14,2) not null default 0,
  value numeric(14,2) not null default 0
);

alter table public.purchase_vouchers enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.purchase_return_vouchers enable row level security;
alter table public.purchase_return_lines enable row level security;

grant select, insert, update, delete on public.purchase_vouchers, public.purchase_lines, public.purchase_return_vouchers, public.purchase_return_lines to authenticated;
grant all on public.purchase_vouchers, public.purchase_lines, public.purchase_return_vouchers, public.purchase_return_lines to service_role;

drop policy if exists "members view purchases" on public.purchase_vouchers;
drop policy if exists "managers manage purchases" on public.purchase_vouchers;
drop policy if exists "members view purchase lines" on public.purchase_lines;
drop policy if exists "managers manage purchase lines" on public.purchase_lines;
drop policy if exists "members view purchase returns" on public.purchase_return_vouchers;
drop policy if exists "managers manage purchase returns" on public.purchase_return_vouchers;
drop policy if exists "members view purchase return lines" on public.purchase_return_lines;
drop policy if exists "managers manage purchase return lines" on public.purchase_return_lines;

create policy "members view purchases" on public.purchase_vouchers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage purchases" on public.purchase_vouchers for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view purchase lines" on public.purchase_lines for select to authenticated using (exists(select 1 from public.purchase_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id())));
create policy "managers manage purchase lines" on public.purchase_lines for all to authenticated using (exists(select 1 from public.purchase_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.purchase_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));
create policy "members view purchase returns" on public.purchase_return_vouchers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage purchase returns" on public.purchase_return_vouchers for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view purchase return lines" on public.purchase_return_lines for select to authenticated using (exists(select 1 from public.purchase_return_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id())));
create policy "managers manage purchase return lines" on public.purchase_return_lines for all to authenticated using (exists(select 1 from public.purchase_return_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.purchase_return_vouchers v where v.id = voucher_id and v.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));
