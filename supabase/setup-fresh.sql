-- =====================================================================
-- KHOPIOPIO - TAO DATABASE MOI TU DAU (chay 1 lan tren Supabase SQL Editor)
-- Gom migrations 001 -> 024 theo thu tu. Moi file duoc commit rieng.
-- Sau khi chay xong: tao tai khoan quan ly bang scripts/create-manager.mjs
-- =====================================================================

-- ===================== 001_initial.sql =====================
create extension if not exists citext;
create type public.app_role as enum ('manager', 'sales');
create type public.order_status as enum ('draft', 'paid', 'cancelled', 'refunded');
create type public.movement_type as enum ('initial', 'purchase', 'sale', 'adjustment', 'return');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  username citext not null unique,
  full_name text not null,
  role public.app_role not null default 'sales',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sku citext not null,
  name text not null,
  price numeric(14,2) not null check (price >= 0),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, sku)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  total_spent numeric(14,2) not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_number bigint generated always as identity,
  customer_id uuid references public.customers(id),
  status public.order_status not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id),
  type public.movement_type not null,
  quantity integer not null check (quantity <> 0),
  reference_id uuid,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.current_store_id() returns uuid language sql stable security definer set search_path = '' as $$ select store_id from public.profiles where id = auth.uid() and active = true $$;
create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = auth.uid() and active = true $$;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on public.stores, public.profiles, public.products, public.customers, public.orders, public.order_items, public.inventory_movements from anon;
grant select on public.stores, public.profiles, public.products, public.customers, public.orders, public.order_items, public.inventory_movements to authenticated;
grant insert, update on public.customers, public.orders, public.order_items to authenticated;
grant insert, update, delete on public.products, public.profiles, public.inventory_movements to authenticated;
grant all on public.stores, public.profiles, public.products, public.customers, public.orders, public.order_items, public.inventory_movements to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.current_store_id() to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;

create policy "store members view store" on public.stores for select to authenticated using (id = (select public.current_store_id()));
create policy "view own profile or manager team" on public.profiles for select to authenticated using (id = auth.uid() or (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));
create policy "manager updates team" on public.profiles for update to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view products" on public.products for select to authenticated using (store_id = (select public.current_store_id()));
create policy "manager creates products" on public.products for insert to authenticated with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "manager updates products" on public.products for update to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "manager deletes products" on public.products for delete to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view customers" on public.customers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "members create customers" on public.customers for insert to authenticated with check (store_id = (select public.current_store_id()) and created_by = auth.uid());
create policy "members update customers" on public.customers for update to authenticated using (store_id = (select public.current_store_id()));
create policy "members view orders" on public.orders for select to authenticated using (store_id = (select public.current_store_id()));
create policy "members create orders" on public.orders for insert to authenticated with check (store_id = (select public.current_store_id()) and created_by = auth.uid());
create policy "manager or creator updates orders" on public.orders for update to authenticated using (store_id = (select public.current_store_id()) and ((select public.current_app_role()) = 'manager' or created_by = auth.uid()));
create policy "members view order items" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and o.store_id = (select public.current_store_id())));
create policy "members create order items" on public.order_items for insert to authenticated with check (exists(select 1 from public.orders o where o.id = order_id and o.store_id = (select public.current_store_id()) and (o.created_by = auth.uid() or (select public.current_app_role()) = 'manager')));
create policy "members update order items" on public.order_items for update to authenticated using (exists(select 1 from public.orders o where o.id = order_id and o.store_id = (select public.current_store_id()) and (o.created_by = auth.uid() or (select public.current_app_role()) = 'manager')));
create policy "members view inventory" on public.inventory_movements for select to authenticated using (store_id = (select public.current_store_id()));
create policy "manager records inventory" on public.inventory_movements for insert to authenticated with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager' and created_by = auth.uid());

create index products_store_idx on public.products(store_id);
create index customers_store_idx on public.customers(store_id);
create index orders_store_created_idx on public.orders(store_id, created_at desc);
create index inventory_store_product_idx on public.inventory_movements(store_id, product_id);

commit;

-- ===================== 002_product_filters.sql =====================
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  parent_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.products add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.products add column if not exists product_type text not null default 'product' check (product_type in ('product','service','combo'));
alter table public.products add column if not exists direct_sale boolean not null default true;
alter table public.products add column if not exists linked_sale_channel boolean not null default false;
alter table public.products add column if not exists expected_out_of_stock_at date;

alter table public.product_categories enable row level security;
alter table public.suppliers enable row level security;
grant select, insert, update, delete on public.product_categories, public.suppliers to authenticated;
grant all on public.product_categories, public.suppliers to service_role;
create policy "members view categories" on public.product_categories for select to authenticated using (store_id = (select public.current_store_id()));
create policy "manager manages categories" on public.product_categories for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view suppliers" on public.suppliers for select to authenticated using (store_id = (select public.current_store_id()));
create policy "manager manages suppliers" on public.suppliers for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create index if not exists product_categories_store_idx on public.product_categories(store_id);
create index if not exists suppliers_store_idx on public.suppliers(store_id);
create index if not exists products_category_idx on public.products(store_id, category_id);
create index if not exists products_supplier_idx on public.products(store_id, supplier_id);


commit;

-- ===================== 003_product_extra.sql =====================
-- 003_product_extra: bổ sung cột còn thiếu cho trang Products giống KiôtViệt
alter table public.products add column if not exists description text;
alter table public.products add column if not exists note text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists location text;
alter table public.products add column if not exists min_stock integer check (min_stock >= 0);
alter table public.products add column if not exists max_stock integer check (max_stock >= 0);
-- đảm bảo các cột từ 002 đã tồn tại (idempotent)
alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.products add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.products add column if not exists product_type text not null default 'product' check (product_type in ('product','service','combo'));
alter table public.products add column if not exists direct_sale boolean not null default true;
alter table public.products add column if not exists linked_sale_channel boolean not null default false;
alter table public.products add column if not exists expected_out_of_stock_at date;
create index if not exists products_description_idx on public.products using gin (to_tsvector('vietnamese', coalesce(description,''))) ;

commit;

-- ===================== 004_product_catalog.sql =====================
-- Complete product catalog backend used by the KiotViet-compatible Products module.
create table if not exists public.product_brands (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists public.store_branches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

insert into public.store_branches (store_id, name, is_default)
select id, 'Chi nhánh trung tâm', true from public.stores s
where not exists (select 1 from public.store_branches b where b.store_id = s.id);

alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists brand_id uuid references public.product_brands(id) on delete set null;
alter table public.products add column if not exists base_unit text not null default 'Cái';
alter table public.products add column if not exists sold_by text not null default 'quantity' check (sold_by in ('quantity','weight'));
alter table public.products add column if not exists weight numeric(14,3) check (weight is null or weight >= 0);
alter table public.products add column if not exists warranty_months integer not null default 0 check (warranty_months >= 0);
alter table public.products add column if not exists tax_percent numeric(5,2) not null default 0 check (tax_percent >= 0);
alter table public.products add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists units jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists price_lists jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists track_inventory boolean not null default true;

create unique index if not exists products_store_barcode_uq on public.products(store_id, barcode) where barcode is not null and barcode <> '';
create index if not exists products_brand_idx on public.products(store_id, brand_id);

create table if not exists public.product_branch_inventory (
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.store_branches(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  reserved numeric(14,3) not null default 0,
  min_stock numeric(14,3),
  max_stock numeric(14,3),
  location text,
  updated_at timestamptz not null default now(),
  primary key(product_id, branch_id)
);

create table if not exists public.product_components (
  product_id uuid not null references public.products(id) on delete cascade,
  component_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  primary key(product_id, component_id),
  check (product_id <> component_id)
);

create table if not exists public.product_import_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  file_name text not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  inserted integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.product_brands enable row level security;
alter table public.store_branches enable row level security;
alter table public.product_branch_inventory enable row level security;
alter table public.product_components enable row level security;
alter table public.product_import_jobs enable row level security;

grant select, insert, update, delete on public.product_brands, public.store_branches, public.product_branch_inventory, public.product_components, public.product_import_jobs to authenticated;
grant all on public.product_brands, public.store_branches, public.product_branch_inventory, public.product_components, public.product_import_jobs to service_role;

drop policy if exists "members view product brands" on public.product_brands;
drop policy if exists "managers manage product brands" on public.product_brands;
drop policy if exists "members view branches" on public.store_branches;
drop policy if exists "managers manage branches" on public.store_branches;
drop policy if exists "members view branch inventory" on public.product_branch_inventory;
drop policy if exists "managers manage branch inventory" on public.product_branch_inventory;
drop policy if exists "members view components" on public.product_components;
drop policy if exists "managers manage components" on public.product_components;
drop policy if exists "members view import jobs" on public.product_import_jobs;
drop policy if exists "managers manage import jobs" on public.product_import_jobs;

create policy "members view product brands" on public.product_brands for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage product brands" on public.product_brands for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view branches" on public.store_branches for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage branches" on public.store_branches for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view branch inventory" on public.product_branch_inventory for select to authenticated using (exists(select 1 from public.products p where p.id = product_id and p.store_id = (select public.current_store_id())));
create policy "managers manage branch inventory" on public.product_branch_inventory for all to authenticated using (exists(select 1 from public.products p where p.id = product_id and p.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.products p where p.id = product_id and p.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));
create policy "members view components" on public.product_components for select to authenticated using (exists(select 1 from public.products p where p.id = product_id and p.store_id = (select public.current_store_id())));
create policy "managers manage components" on public.product_components for all to authenticated using (exists(select 1 from public.products p where p.id = product_id and p.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager')) with check (exists(select 1 from public.products p where p.id = product_id and p.store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager'));
create policy "members view import jobs" on public.product_import_jobs for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage import jobs" on public.product_import_jobs for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

-- Public product images. Uploads are still authenticated and scoped by API path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated upload product images" on storage.objects;
drop policy if exists "public view product images" on storage.objects;
drop policy if exists "authenticated update product images" on storage.objects;
drop policy if exists "authenticated delete product images" on storage.objects;

create policy "authenticated upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "public view product images" on storage.objects for select to public using (bucket_id = 'product-images');
create policy "authenticated update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images');
create policy "authenticated delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');

commit;

-- ===================== 005_voucher_modules.sql =====================
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

commit;

-- ===================== 006_suppliers_purchasing.sql =====================
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

commit;

-- ===================== 007_sales_orders_shipping.sql =====================
-- Persistent sales orders, full-order returns, delivery partners and waybills.
alter table public.orders add column if not exists note text;
alter table public.orders add column if not exists channel text not null default 'direct';
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists branch_id uuid references public.store_branches(id) on delete set null;
alter table public.customers add column if not exists customer_number bigint generated by default as identity;
alter table public.order_items add column if not exists affects_inventory boolean;
alter table public.order_items add column if not exists affects_branch_inventory boolean;
update public.order_items i set affects_inventory = case
  when o.status in ('paid'::public.order_status, 'refunded'::public.order_status) then exists(
    select 1 from public.inventory_movements movement
    where movement.reference_id = i.order_id and movement.product_id = i.product_id and movement.type = 'sale'::public.movement_type
  )
  else p.track_inventory
end
from public.orders o, public.products p
where o.id = i.order_id and p.id = i.product_id and i.affects_inventory is null;
update public.order_items set affects_branch_inventory = false where affects_branch_inventory is null;
alter table public.order_items alter column affects_inventory set default true;
alter table public.order_items alter column affects_inventory set not null;
alter table public.order_items alter column affects_branch_inventory set default false;
alter table public.order_items alter column affects_branch_inventory set not null;

-- Legacy stores started with one central branch. Allocate stock there only when
-- a product has never had any branch allocation, then attach legacy orders.
insert into public.product_branch_inventory(product_id, branch_id, quantity)
select p.id, b.id, p.stock_quantity
from public.products p
join lateral (
  select id from public.store_branches where store_id = p.store_id and active order by is_default desc, created_at limit 1
) b on true
where p.track_inventory and not exists(select 1 from public.product_branch_inventory inventory where inventory.product_id = p.id)
on conflict(product_id, branch_id) do nothing;
update public.orders o set branch_id = (
  select id from public.store_branches where store_id = o.store_id and active order by is_default desc, created_at limit 1
) where o.branch_id is null;

-- Sales documents must only be changed through the transactional functions below.
revoke insert, update on public.orders, public.order_items from authenticated;
drop policy if exists "members create orders" on public.orders;
drop policy if exists "manager or creator updates orders" on public.orders;
drop policy if exists "members create order items" on public.order_items;
drop policy if exists "members update order items" on public.order_items;
revoke insert, update on public.customers from authenticated;
grant insert(store_id, name, phone, email, created_by) on public.customers to authenticated;
grant update(name, phone, email) on public.customers to authenticated;

create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  return_number bigint generated always as identity,
  order_id uuid not null references public.orders(id) on delete restrict,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  subtotal numeric(14,2) not null default 0 check (subtotal between 0 and 999999999999.99),
  refund_amount numeric(14,2) not null default 0 check (refund_amount between 0 and 999999999999.99),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, order_id)
);

create table if not exists public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sales_returns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price between 0 and 999999999999.99),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored
);

create table if not exists public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  partner_number bigint generated always as identity,
  name text not null,
  phone text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shipment_number bigint generated always as identity,
  order_id uuid not null references public.orders(id) on delete restrict,
  partner_id uuid references public.delivery_partners(id) on delete set null,
  status text not null default 'pending_pickup' check (status in ('pending_pickup','picked_up','delivering','delivered','failed','returning','returned','cancelled')),
  receiver_name text not null,
  receiver_phone text,
  address text,
  area text,
  service text,
  cod_amount numeric(14,2) not null default 0 check (cod_amount between 0 and 999999999999.99),
  collected_cod numeric(14,2) not null default 0 check (collected_cod between 0 and cod_amount),
  shipping_fee numeric(14,2) not null default 0 check (shipping_fee between 0 and 999999999999.99),
  partner_fee numeric(14,2) not null default 0 check (partner_fee between 0 and 999999999999.99),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  delivery_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(store_id, order_id)
);

create table if not exists public.shipment_status_history (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null check (status in ('pending_pickup','picked_up','delivering','delivered','failed','returning','returned','cancelled')),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.sales_returns enable row level security;
alter table public.sales_return_items enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_status_history enable row level security;

grant select on public.sales_returns, public.sales_return_items, public.delivery_partners, public.shipments, public.shipment_status_history to authenticated;
grant insert, update on public.delivery_partners to authenticated;
grant all on public.sales_returns, public.sales_return_items, public.delivery_partners, public.shipments, public.shipment_status_history to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "members view sales returns" on public.sales_returns;
drop policy if exists "members view sales return items" on public.sales_return_items;
drop policy if exists "members view delivery partners" on public.delivery_partners;
drop policy if exists "managers manage delivery partners" on public.delivery_partners;
drop policy if exists "members view shipments" on public.shipments;
drop policy if exists "members view shipment history" on public.shipment_status_history;
create policy "members view sales returns" on public.sales_returns for select to authenticated using (store_id = (select public.current_store_id()));
create policy "members view sales return items" on public.sales_return_items for select to authenticated using (exists(select 1 from public.sales_returns r where r.id = return_id and r.store_id = (select public.current_store_id())));
create policy "members view delivery partners" on public.delivery_partners for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage delivery partners" on public.delivery_partners for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
create policy "members view shipments" on public.shipments for select to authenticated using (store_id = (select public.current_store_id()));
create policy "members view shipment history" on public.shipment_status_history for select to authenticated using (exists(select 1 from public.shipments s where s.id = shipment_id and s.store_id = (select public.current_store_id())));

create index if not exists sales_returns_store_created_idx on public.sales_returns(store_id, created_at desc);
create index if not exists sales_return_items_return_idx on public.sales_return_items(return_id);
create index if not exists delivery_partners_store_name_idx on public.delivery_partners(store_id, name);
create index if not exists shipments_store_created_idx on public.shipments(store_id, created_at desc);
create index if not exists shipments_partner_status_idx on public.shipments(store_id, partner_id, status);
create index if not exists shipment_history_shipment_idx on public.shipment_status_history(shipment_id, created_at);

create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_status public.order_status,
  p_note text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric(14,2);
  v_item_count integer;
  v_product_count integer;
  v_branch_id uuid;
begin
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền tạo đơn hàng'; end if;
  if p_status not in ('draft'::public.order_status, 'paid'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Đơn hàng phải có ít nhất một hàng hóa'; end if;
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

  insert into public.orders(store_id, customer_id, status, subtotal, discount, total, note, branch_id, created_by, updated_at)
  values(v_store_id, p_customer_id, p_status, v_subtotal, 0, v_subtotal, nullif(trim(p_note), ''), v_branch_id, v_user_id, now())
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
      update public.customers set total_spent = total_spent + v_subtotal where id = p_customer_id and store_id = v_store_id;
    end if;
  end if;

  return v_order_id;
end;
$$;

create or replace function public.transition_sales_order(p_order_id uuid, p_status public.order_status) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_branch_id uuid;
  v_subtotal numeric(14,2);
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm mới được cập nhật'; end if;
  if p_status = 'cancelled'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if exists(
    select 1
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
    join public.products p on p.id = sold.product_id and p.store_id = v_store_id
    left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
    where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
  ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất bán theo hóa đơn', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_subtotal where id = v_order.customer_id and store_id = v_store_id;
  end if;
  update public.orders set status = 'paid'::public.order_status, subtotal = v_subtotal, discount = 0, total = v_subtotal, branch_id = v_branch_id, updated_at = now() where id = p_order_id;
end;
$$;

create or replace function public.refund_sales_order(p_order_id uuid, p_note text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_return_id uuid;
  v_shipment_status text;
  v_shipment_cod numeric(14,2);
  v_collected_cod numeric(14,2);
  v_subtotal numeric(14,2);
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền trả hàng'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy hóa đơn'; end if;
  if v_order.status <> 'paid'::public.order_status then raise exception 'Chỉ hóa đơn hoàn thành mới được trả hàng'; end if;
  if exists(select 1 from public.sales_returns where order_id = p_order_id and store_id = v_store_id) then raise exception 'Hóa đơn đã được trả hàng'; end if;
  select status, cod_amount, collected_cod into v_shipment_status, v_shipment_cod, v_collected_cod from public.shipments where order_id = p_order_id and store_id = v_store_id for update;
  if v_shipment_status in ('pending_pickup','picked_up','delivering','failed','returning') then raise exception 'Không thể trả hóa đơn khi vận đơn đang xử lý'; end if;
  if v_shipment_status = 'delivered' and v_collected_cod < v_shipment_cod then raise exception 'Không thể trả hóa đơn khi COD chưa thu đủ'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Hóa đơn có hàng hóa không thuộc cửa hàng'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 or v_order.subtotal <> v_subtotal or v_order.discount not between 0 and v_subtotal or v_order.total <> v_subtotal - v_order.discount then raise exception 'Tổng tiền hóa đơn không hợp lệ'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and affects_branch_inventory) and (v_order.branch_id is null or not exists(select 1 from public.store_branches where id = v_order.branch_id and store_id = v_store_id)) then raise exception 'Chi nhánh hóa đơn không hợp lệ'; end if;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform i.product_id from public.product_branch_inventory i join public.order_items oi on oi.product_id = i.product_id where oi.order_id = p_order_id and oi.affects_branch_inventory and i.branch_id = v_order.branch_id for update of i;
  if exists(
    select 1 from public.order_items line
    left join public.product_branch_inventory inventory on inventory.product_id = line.product_id and inventory.branch_id = v_order.branch_id
    where line.order_id = p_order_id and line.affects_branch_inventory and inventory.product_id is null
  ) then raise exception 'Tồn kho chi nhánh của hóa đơn không hợp lệ'; end if;

  insert into public.sales_returns(store_id, order_id, status, subtotal, refund_amount, note, created_by)
  values(v_store_id, p_order_id, 'completed', v_order.subtotal, v_order.total, nullif(trim(p_note), ''), v_user_id)
  returning id into v_return_id;

  insert into public.sales_return_items(return_id, product_id, quantity, unit_price)
  select v_return_id, product_id, quantity, unit_price from public.order_items where order_id = p_order_id;

  update public.products p
  set stock_quantity = p.stock_quantity + i.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) i
  where p.id = i.product_id and p.store_id = v_store_id;

  update public.product_branch_inventory i
  set quantity = i.quantity + returned.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) returned
  where i.product_id = returned.product_id and i.branch_id = v_order.branch_id;

  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, returned.product_id, 'return'::public.movement_type, returned.quantity, v_return_id, 'Nhập lại tồn do trả hàng bán', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) returned;

  update public.orders set status = 'refunded'::public.order_status, updated_at = now() where id = p_order_id;
  if v_order.customer_id is not null then
    update public.customers set total_spent = greatest(0, total_spent - v_order.total) where id = v_order.customer_id and store_id = v_store_id;
  end if;
  return v_return_id;
end;
$$;

create or replace function public.create_shipment(
  p_order_id uuid,
  p_partner_id uuid,
  p_receiver_name text,
  p_receiver_phone text,
  p_address text,
  p_area text,
  p_cod_amount numeric,
  p_shipping_fee numeric,
  p_partner_fee numeric,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_shipment_id uuid;
  v_order public.orders%rowtype;
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền tạo vận đơn'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found or v_order.status <> 'paid'::public.order_status then raise exception 'Chỉ hóa đơn hoàn thành mới được tạo vận đơn'; end if;
  if p_partner_id is not null and not exists(select 1 from public.delivery_partners where id = p_partner_id and store_id = v_store_id and active) then raise exception 'Đối tác giao hàng không hợp lệ'; end if;
  if coalesce(trim(p_receiver_name), '') = '' then raise exception 'Người nhận là bắt buộc'; end if;
  if coalesce(p_cod_amount, 0) not between 0 and 999999999999.99 or coalesce(p_shipping_fee, 0) not between 0 and 999999999999.99 or coalesce(p_partner_fee, 0) not between 0 and 999999999999.99 then raise exception 'Số tiền vận đơn không hợp lệ'; end if;
  if coalesce(p_cod_amount, 0) > v_order.total + coalesce(p_shipping_fee, 0) then raise exception 'Tiền thu hộ vượt quá giá trị hóa đơn và phí giao hàng'; end if;

  insert into public.shipments(store_id, order_id, partner_id, receiver_name, receiver_phone, address, area, cod_amount, shipping_fee, partner_fee, note, created_by)
  values(v_store_id, p_order_id, p_partner_id, trim(p_receiver_name), nullif(trim(p_receiver_phone), ''), nullif(trim(p_address), ''), nullif(trim(p_area), ''), coalesce(p_cod_amount, 0), coalesce(p_shipping_fee, 0), coalesce(p_partner_fee, 0), nullif(trim(p_note), ''), v_user_id)
  returning id into v_shipment_id;
  insert into public.shipment_status_history(shipment_id, status, note, created_by) values(v_shipment_id, 'pending_pickup', 'Tạo vận đơn', v_user_id);
  return v_shipment_id;
end;
$$;

drop function if exists public.transition_shipment(uuid, text, text);
create or replace function public.transition_shipment(p_shipment_id uuid, p_status text, p_note text, p_collected_cod numeric) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_current text;
  v_cod_amount numeric(14,2);
  v_allowed boolean := false;
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền cập nhật vận đơn'; end if;
  select status, cod_amount into v_current, v_cod_amount from public.shipments where id = p_shipment_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy vận đơn'; end if;
  v_allowed := case v_current
    when 'pending_pickup' then p_status in ('picked_up','cancelled')
    when 'picked_up' then p_status in ('delivering','returning')
    when 'delivering' then p_status in ('delivered','failed','returning')
    when 'failed' then p_status in ('delivering','returning')
    when 'returning' then p_status = 'returned'
    else false end;
  if not v_allowed then raise exception 'Chuyển trạng thái vận đơn không hợp lệ'; end if;
  if p_status = 'delivered' and (p_collected_cod is null or p_collected_cod not between 0 and v_cod_amount) then raise exception 'Tiền COD thực thu không hợp lệ'; end if;
  if p_status <> 'delivered' and p_collected_cod is not null then raise exception 'Chỉ ghi nhận COD khi giao thành công'; end if;

  update public.shipments set
    status = p_status,
    delivery_at = case when p_status = 'delivering' and delivery_at is null then now() else delivery_at end,
    completed_at = case when p_status in ('delivered','returned','cancelled') then now() else completed_at end,
    collected_cod = case when p_status = 'delivered' then p_collected_cod else collected_cod end,
    updated_at = now()
  where id = p_shipment_id;
  insert into public.shipment_status_history(shipment_id, status, note, created_by) values(p_shipment_id, p_status, nullif(trim(p_note), ''), v_user_id);
end;
$$;

revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb) from public;
revoke all on function public.transition_sales_order(uuid, public.order_status) from public;
revoke all on function public.refund_sales_order(uuid, text) from public;
revoke all on function public.create_shipment(uuid, uuid, text, text, text, text, numeric, numeric, numeric, text) from public;
revoke all on function public.transition_shipment(uuid, text, text, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb) to authenticated, service_role;
grant execute on function public.transition_sales_order(uuid, public.order_status) to authenticated, service_role;
grant execute on function public.refund_sales_order(uuid, text) to authenticated, service_role;
grant execute on function public.create_shipment(uuid, uuid, text, text, text, text, numeric, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.transition_shipment(uuid, text, text, numeric) to authenticated, service_role;

commit;

-- ===================== 008_customers_cashbook.sql =====================
-- Customer profile extensions and normalized customer groups.
create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, name)
);

alter table public.customers add column if not exists group_id uuid references public.customer_groups(id) on delete set null;
alter table public.customers add column if not exists secondary_phone text;
alter table public.customers add column if not exists birthday date;
alter table public.customers add column if not exists gender text check (gender is null or gender in ('male','female'));
alter table public.customers add column if not exists customer_type text not null default 'individual' check (customer_type in ('individual','company'));
alter table public.customers add column if not exists facebook text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists area text;
alter table public.customers add column if not exists ward text;
alter table public.customers add column if not exists note text;
alter table public.customers add column if not exists tax_code text;
alter table public.customers add column if not exists identity_number text;
alter table public.customers add column if not exists organization text;
alter table public.customers add column if not exists buyer_name text;
alter table public.customers add column if not exists invoice_address text;
alter table public.customers add column if not exists invoice_email text;
alter table public.customers add column if not exists bank_name text;
alter table public.customers add column if not exists bank_account text;
alter table public.customers add column if not exists active boolean not null default true;
alter table public.customers add column if not exists favorite boolean not null default false;
alter table public.customers add column if not exists updated_at timestamptz not null default now();

create or replace function public.validate_customer_group_store() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.group_id is not null and not exists(
    select 1 from public.customer_groups g where g.id = new.group_id and g.store_id = new.store_id
  ) then raise exception 'Nhóm khách hàng không thuộc cửa hàng'; end if;
  return new;
end;
$$;
drop trigger if exists validate_customer_group_store on public.customers;
create trigger validate_customer_group_store before insert or update of group_id, store_id on public.customers for each row execute function public.validate_customer_group_store();

alter table public.customer_groups enable row level security;
grant select, insert, update, delete on public.customer_groups to authenticated;
grant all on public.customer_groups to service_role;
drop policy if exists "members view customer groups" on public.customer_groups;
drop policy if exists "managers manage customer groups" on public.customer_groups;
create policy "members view customer groups" on public.customer_groups for select to authenticated using (store_id = (select public.current_store_id()));
create policy "managers manage customer groups" on public.customer_groups for all to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');

drop policy if exists "members create customers" on public.customers;
drop policy if exists "members update customers" on public.customers;
create policy "managers create customers" on public.customers for insert to authenticated with check (store_id = (select public.current_store_id()) and created_by = auth.uid() and (select public.current_app_role()) = 'manager');
create policy "managers update customers" on public.customers for update to authenticated using (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager') with check (store_id = (select public.current_store_id()) and (select public.current_app_role()) = 'manager');
revoke insert, update on public.customers from authenticated;
grant insert(store_id, name, phone, email, created_by, group_id, secondary_phone, birthday, gender, customer_type, facebook, address, area, ward, note, tax_code, identity_number, organization, buyer_name, invoice_address, invoice_email, bank_name, bank_account, active, favorite) on public.customers to authenticated;
grant update(name, phone, email, group_id, secondary_phone, birthday, gender, customer_type, facebook, address, area, ward, note, tax_code, identity_number, organization, buyer_name, invoice_address, invoice_email, bank_name, bank_account, active, favorite, updated_at) on public.customers to authenticated;

create index if not exists customers_store_number_idx on public.customers(store_id, customer_number desc);
create index if not exists customers_store_group_idx on public.customers(store_id, group_id);
create index if not exists customers_store_name_idx on public.customers(store_id, lower(name));
create index if not exists customers_store_phone_idx on public.customers(store_id, phone);

-- =====================================================================
-- CashBook (Sổ quỹ) — real transaction ledger.
-- Funds: Tiền mặt / Ngân hàng / Ví điện tử each map to a cash account of
-- that type. Receipts (Phiếu thu) and payments (Phiếu chi) are stored as
-- immutable vouchers whose amounts only ever contribute to a running fund
-- balance while status = 'completed'. Cancellation flips status but keeps
-- the row for audit. CashBook is an independent manual ledger: it does NOT
-- auto-consume order payments, supplier payables or customer debt, which
-- prevents double-counting with the sales/purchasing modules.
-- =====================================================================

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  account_type text not null check (account_type in ('cash','bank','ewallet')),
  opening_balance numeric(14,2) not null default 0 check (opening_balance between 0 and 999999999999.99),
  bank_name text,
  bank_account text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists public.cash_vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  voucher_number bigint generated always as identity,
  account_id uuid not null references public.cash_accounts(id) on delete restrict,
  type text not null check (type in ('receipt','expense')),
  kind text not null check (kind in ('sale_payment','debt_collection','other_income','transfer_in','purchase_payment','debt_payment','other_expense','transfer_out')),
  amount numeric(14,2) not null check (amount > 0 and amount <= 999999999999.99),
  partner_kind text check (partner_kind in ('customer','supplier')),
  partner_id uuid,
  partner_name text,
  note text,
  affects_profit boolean not null default true,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cash_accounts enable row level security;
alter table public.cash_vouchers enable row level security;

grant select on public.cash_accounts, public.cash_vouchers to authenticated;
grant all on public.cash_accounts, public.cash_vouchers to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "members view cash accounts" on public.cash_accounts;
drop policy if exists "members view cash vouchers" on public.cash_vouchers;
create policy "members view cash accounts" on public.cash_accounts for select to authenticated using (store_id = (select public.current_store_id()));
create policy "members view cash vouchers" on public.cash_vouchers for select to authenticated using (store_id = (select public.current_store_id()));

create index if not exists cash_accounts_store_type_idx on public.cash_accounts(store_id, account_type);
create index if not exists cash_vouchers_store_occurred_idx on public.cash_vouchers(store_id, occurred_at desc);
create index if not exists cash_vouchers_store_account_idx on public.cash_vouchers(store_id, account_id);
create index if not exists cash_vouchers_store_partner_idx on public.cash_vouchers(store_id, partner_kind, partner_id);

-- Seed the three default funds for stores that already exist.
do $$
begin
  insert into public.cash_accounts(store_id, name, account_type, opening_balance, created_by)
  select s.id, seed.name, seed.account_type, 0, owner.id
  from public.stores s
  cross join (values ('Tiền mặt','cash'),('Ngân hàng','bank'),('Ví điện tử','ewallet')) as seed(name, account_type)
  left join lateral (select id from public.profiles where store_id = s.id order by created_at limit 1) owner on true
  where not exists(select 1 from public.cash_accounts a where a.store_id = s.id and a.account_type = seed.account_type);
end;
$$;

-- New stores automatically get the three default funds. The account seed must
-- not depend on a profile, so created_by stays null until a voucher is made.
create or replace function public.cashbook_seed_accounts_on_store() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cash_accounts(store_id, name, account_type, opening_balance, created_by)
  select new.id, seed.name, seed.account_type, 0, null
  from (values ('Tiền mặt','cash'),('Ngân hàng','bank'),('Ví điện tử','ewallet')) as seed(name, account_type);
  return new;
end;
$$;
drop trigger if exists cashbook_seed_accounts_on_store on public.stores;
create trigger cashbook_seed_accounts_on_store after insert on public.stores for each row execute function public.cashbook_seed_accounts_on_store();

create or replace function public.cashbook_create_account(
  p_name text,
  p_account_type text,
  p_opening_balance numeric,
  p_bank_name text,
  p_bank_account text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_account_id uuid;
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền tạo tài khoản quỹ'; end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 120 then raise exception 'Tên tài khoản quỹ không hợp lệ'; end if;
  if p_account_type not in ('cash','bank','ewallet') then raise exception 'Loại quỹ không hợp lệ'; end if;
  if coalesce(p_opening_balance, 0) not between 0 and 999999999999.99 then raise exception 'Số dư đầu kỳ không hợp lệ'; end if;
  if exists(select 1 from public.cash_accounts where store_id = v_store_id and name = trim(p_name)) then raise exception 'Tài khoản quỹ đã tồn tại'; end if;
  insert into public.cash_accounts(store_id, name, account_type, opening_balance, bank_name, bank_account, created_by)
  values(v_store_id, trim(p_name), p_account_type, coalesce(p_opening_balance, 0), nullif(trim(p_bank_name), ''), nullif(trim(p_bank_account), ''), v_user_id)
  returning id into v_account_id;
  return v_account_id;
end;
$$;

create or replace function public.cashbook_update_account(
  p_account_id uuid,
  p_name text,
  p_opening_balance numeric,
  p_bank_name text,
  p_bank_account text,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền cập nhật tài khoản quỹ'; end if;
  if not exists(select 1 from public.cash_accounts where id = p_account_id and store_id = v_store_id) then raise exception 'Không tìm thấy tài khoản quỹ'; end if;
  if p_name is not null and (char_length(trim(p_name)) between 1 and 120) and exists(select 1 from public.cash_accounts where store_id = v_store_id and name = trim(p_name) and id <> p_account_id) then raise exception 'Tên tài khoản quỹ đã tồn tại'; end if;
  if p_opening_balance is not null and p_opening_balance not between 0 and 999999999999.99 then raise exception 'Số dư đầu kỳ không hợp lệ'; end if;
  update public.cash_accounts set
    name = coalesce(nullif(trim(p_name), ''), name),
    opening_balance = coalesce(p_opening_balance, opening_balance),
    bank_name = case when p_bank_name is not null then nullif(trim(p_bank_name), '') else bank_name end,
    bank_account = case when p_bank_account is not null then nullif(trim(p_bank_account), '') else bank_account end,
    active = coalesce(p_active, active),
    updated_at = now()
  where id = p_account_id and store_id = v_store_id;
end;
$$;

create or replace function public.cashbook_create_voucher(
  p_account_id uuid,
  p_type text,
  p_kind text,
  p_amount numeric,
  p_partner_kind text,
  p_partner_id uuid,
  p_partner_name text,
  p_note text,
  p_occurred_at timestamptz,
  p_affects_profit boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_voucher_id uuid;
  v_account_type text;
  v_kinds_receipt constant text[] := array['sale_payment','debt_collection','other_income','transfer_in'];
  v_kinds_expense constant text[] := array['purchase_payment','debt_payment','other_expense','transfer_out'];
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền tạo phiếu thu chi'; end if;
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if p_type not in ('receipt','expense') then raise exception 'Loại phiếu không hợp lệ'; end if;
  if p_type = 'receipt' and not (p_kind = any(v_kinds_receipt)) then raise exception 'Loại thu không hợp lệ'; end if;
  if p_type = 'expense' and not (p_kind = any(v_kinds_expense)) then raise exception 'Loại chi không hợp lệ'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 then raise exception 'Số tiền giao dịch không hợp lệ'; end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '1 day' then raise exception 'Thời gian giao dịch không hợp lệ'; end if;
  select account_type into v_account_type from public.cash_accounts where id = p_account_id and store_id = v_store_id and active;
  if v_account_type is null then raise exception 'Không tìm thấy tài khoản quỹ'; end if;

  if p_partner_kind is not null and p_partner_kind not in ('customer','supplier') then raise exception 'Loại đối tượng không hợp lệ'; end if;
  if p_partner_kind is not null and p_partner_id is null then raise exception 'Đối tượng giao dịch không hợp lệ'; end if;
  if p_partner_kind = 'customer' and not exists(select 1 from public.customers c where c.id = p_partner_id and c.store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if p_partner_kind = 'supplier' and not exists(select 1 from public.suppliers s where s.id = p_partner_id and s.store_id = v_store_id) then raise exception 'Nhà cung cấp không thuộc cửa hàng'; end if;

  insert into public.cash_vouchers(store_id, account_id, type, kind, amount, partner_kind, partner_id, partner_name, note, affects_profit, status, occurred_at, created_by)
  values(v_store_id, p_account_id, p_type, p_kind, p_amount, p_partner_kind, p_partner_id, nullif(trim(p_partner_name), ''), nullif(trim(p_note), ''), coalesce(p_affects_profit, true), 'completed', p_occurred_at, v_user_id)
  returning id into v_voucher_id;
  return v_voucher_id;
end;
$$;

create or replace function public.cashbook_cancel_voucher(p_voucher_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền hủy phiếu'; end if;
  if not exists(select 1 from public.cash_vouchers where id = p_voucher_id and store_id = v_store_id) then raise exception 'Không tìm thấy phiếu'; end if;
  update public.cash_vouchers
  set status = 'cancelled', cancelled_by = v_user_id, cancelled_at = now(), updated_at = now()
  where id = p_voucher_id and store_id = v_store_id and status = 'completed';
  if not found then raise exception 'Chỉ phiếu chưa hủy mới được hủy'; end if;
end;
$$;

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
  ), movements as (
    select v.type, v.amount
    from public.cash_vouchers v
    join accounts a on a.id = v.account_id
    where v.status = 'completed'
      and (p_from is null or v.occurred_at >= p_from)
      and (p_to is null or v.occurred_at <= p_to)
  )
  select
    coalesce((select sum(a.opening_balance) from accounts a), 0),
    coalesce((select sum(m.amount) from movements m where m.type = 'receipt'), 0),
    coalesce((select sum(m.amount) from movements m where m.type = 'expense'), 0);
$$;

revoke all on function public.cashbook_create_account(text, text, numeric, text, text) from public;
revoke all on function public.cashbook_update_account(uuid, text, numeric, text, text, boolean) from public;
revoke all on function public.cashbook_create_voucher(uuid, text, text, numeric, text, uuid, text, text, timestamptz, boolean) from public;
revoke all on function public.cashbook_cancel_voucher(uuid) from public;
revoke all on function public.cashbook_summary(uuid[], timestamptz, timestamptz) from public;
grant execute on function public.cashbook_create_account(text, text, numeric, text, text) to authenticated, service_role;
grant execute on function public.cashbook_update_account(uuid, text, numeric, text, text, boolean) to authenticated, service_role;
grant execute on function public.cashbook_create_voucher(uuid, text, text, numeric, text, uuid, text, text, timestamptz, boolean) to authenticated, service_role;
grant execute on function public.cashbook_cancel_voucher(uuid) to authenticated, service_role;
grant execute on function public.cashbook_summary(uuid[], timestamptz, timestamptz) to authenticated, service_role;

commit;

-- ===================== 009_settings.sql =====================
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

commit;

-- ===================== 010_settings_extras.sql =====================
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
commit;

-- ===================== 011_data_deletion.sql =====================
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
commit;

-- ===================== 012_settings_extended.sql =====================
-- =====================================================================
-- 012_settings_extended.sql — KiotViet-compatible settings columns
-- Idempotent, safe to apply on top of 000-011.
-- =====================================================================

-- New store_settings columns for KiotViet settings coverage
alter table public.store_settings add column if not exists allow_change_transaction_date boolean not null default false;
alter table public.store_settings add column if not exists auto_suggest_product_info boolean not null default true;
alter table public.store_settings add column if not exists barcode_management boolean not null default true;
alter table public.store_settings add column if not exists product_group_permissions_enabled boolean not null default false;
alter table public.store_settings add column if not exists reward_points_enabled boolean not null default false;
alter table public.store_settings add column if not exists reward_point_rate numeric(10,2) not null default 10000;
alter table public.store_settings add column if not exists default_tax_rate numeric(5,2) not null default 0;
alter table public.store_settings add column if not exists invoice_template text not null default 'standard';
alter table public.store_settings add column if not exists enable_sms boolean not null default false;
alter table public.store_settings add column if not exists enable_zalo boolean not null default false;
alter table public.store_settings add column if not exists enable_delivery boolean not null default true;
alter table public.store_settings add column if not exists enable_payment_gateway boolean not null default false;
alter table public.store_settings add column if not exists loyalty_program_enabled boolean not null default false;

-- Seed default row for stores missing settings
insert into public.store_settings(store_id)
select s.id from public.stores s
where not exists (select 1 from public.store_settings ss where ss.store_id = s.id);
commit;

-- ===================== 013_fix_sales_discount_branch.sql =====================
-- P0 fix: discount handling, timezone/branch/pagination support (migration for discount)
-- Allow discount from client -> RPC, fix payable = total calculation

drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb);

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
  v_order_id uuid;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2) := coalesce(p_discount, 0);
  v_total numeric(14,2);
  v_item_count integer;
  v_product_count integer;
  v_branch_id uuid;
begin
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền tạo đơn hàng'; end if;
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

-- Keep transition consistent: preserve discount, recalc total = subtotal - discount (discount already stored)
create or replace function public.transition_sales_order(p_order_id uuid, p_status public.order_status) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_branch_id uuid;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm mới được cập nhật'; end if;
  if p_status = 'cancelled'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;
  v_discount := coalesce(v_order.discount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Giảm giá không hợp lệ'; end if;
  v_total := v_subtotal - v_discount;

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if exists(
    select 1
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
    join public.products p on p.id = sold.product_id and p.store_id = v_store_id
    left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
    where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
  ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất bán theo hóa đơn', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = v_order.customer_id and store_id = v_store_id;
  end if;
  update public.orders set status = 'paid'::public.order_status, subtotal = v_subtotal, discount = v_discount, total = v_total, branch_id = v_branch_id, updated_at = now() where id = p_order_id;
end;
$$;

revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric) to authenticated, service_role;
revoke all on function public.transition_sales_order(uuid, public.order_status) from public;
grant execute on function public.transition_sales_order(uuid, public.order_status) to authenticated, service_role;

commit;

-- ===================== 014_fix_p0_cashbook_customers.sql =====================
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

commit;

-- ===================== 015_allow_sales_create_order.sql =====================
-- P0 fix: allow sales role to create and transition orders (POS permission)
-- previously only manager could create; sales staff must be able to sell

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

create or replace function public.transition_sales_order(p_order_id uuid, p_status public.order_status) returns void
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
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm mới được cập nhật'; end if;
  if p_status = 'cancelled'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;
  v_discount := coalesce(v_order.discount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Giảm giá không hợp lệ'; end if;
  v_total := v_subtotal - v_discount;

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if exists(
    select 1
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
    join public.products p on p.id = sold.product_id and p.store_id = v_store_id
    left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
    where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
  ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất bán theo hóa đơn', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = v_order.customer_id and store_id = v_store_id;
  end if;
  update public.orders set status = 'paid'::public.order_status, subtotal = v_subtotal, discount = v_discount, total = v_total, branch_id = v_branch_id, updated_at = now() where id = p_order_id;
end;
$$;

revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric) to authenticated, service_role;
revoke all on function public.transition_sales_order(uuid, public.order_status) from public;
grant execute on function public.transition_sales_order(uuid, public.order_status) to authenticated, service_role;

commit;

-- ===================== 016_revoke_customer_debt_view.sql =====================
-- P0 Security fix: customer_debt_view bypassed store isolation (views bypass RLS).
-- The app only uses customers_by_debt() RPC which is store-isolated via current_store_id().
revoke select on public.customer_debt_view from authenticated;
grant select on public.customer_debt_view to service_role;

commit;

-- ===================== 017_fix_p0_movement_enum_debt.sql =====================
-- 017: P0 fix — enum movement_type thiếu giá trị mà app đang insert
-- (purchase_return, damage, internal_use) khiến mọi phiếu trả hàng nhập /
-- xuất hủy / xuất nội bộ GHI LỊCH SỬ KHO THẤT BẠI.
-- Chạy standalone (ALTER TYPE ADD VALUE không được nằm trong transaction block).

alter type public.movement_type add value if not exists 'purchase_return';
alter type public.movement_type add value if not exists 'damage';
alter type public.movement_type add value if not exists 'internal_use';

-- P1: đơn refunded không được tính là nợ khách (customers_by_debt)
-- LƯU Ý: giữ nguyên return type table(customer_id uuid) như bản 014
-- (app chỉ đọc customer_id; đổi return type phải DROP FUNCTION trước)
drop function if exists public.customers_by_debt(numeric, numeric);

create function public.customers_by_debt(p_min numeric, p_max numeric)
returns table(customer_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id as customer_id
  from public.customers c
  left join public.orders o
    on o.customer_id = c.id
   and o.store_id = c.store_id
   and o.status not in ('draft', 'cancelled', 'refunded')
  left join public.shipments s
    on s.order_id = o.id
   and s.status <> 'cancelled'
  group by c.id
  having coalesce(sum(greatest(0, s.cod_amount - s.collected_cod)), 0)
         between coalesce(p_min, -1e12) and coalesce(p_max, 1e12)
$$;

revoke all on function public.customers_by_debt(numeric, numeric) from public;
grant execute on function public.customers_by_debt(numeric, numeric) to authenticated, service_role;

-- P1: index cho join công nợ theo khách hàng
create index if not exists orders_customer_idx on public.orders(customer_id);

commit;

-- ===================== 018_business_enhancements.sql =====================
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

commit;

-- ===================== 019_ensure_product_units.sql =====================
-- 019_ensure_product_units: đảm bảo đủ cột catalog cho Hàng hóa (gộp 003 + 004, chạy lại an toàn)
-- Mục đích: sửa lỗi "Không thể cập nhật hàng hóa" khi DB chưa có cột units / base_unit / ... để lưu Đơn vị quy đổi (số cái/thùng)

create table if not exists public.product_brands (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

-- 003: cột mở rộng
alter table public.products add column if not exists description text;
alter table public.products add column if not exists note text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists location text;
alter table public.products add column if not exists min_stock integer check (min_stock >= 0);
alter table public.products add column if not exists max_stock integer check (max_stock >= 0);

-- 004: cột catalog + đơn vị quy đổi
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists brand_id uuid references public.product_brands(id) on delete set null;
alter table public.products add column if not exists base_unit text not null default 'Cái';
alter table public.products add column if not exists sold_by text not null default 'quantity' check (sold_by in ('quantity','weight'));
alter table public.products add column if not exists weight numeric(14,3) check (weight is null or weight >= 0);
alter table public.products add column if not exists warranty_months integer not null default 0 check (warranty_months >= 0);
alter table public.products add column if not exists tax_percent numeric(5,2) not null default 0 check (tax_percent >= 0);
alter table public.products add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists units jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists price_lists jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists track_inventory boolean not null default true;

create unique index if not exists products_store_barcode_uq on public.products(store_id, barcode) where barcode is not null and barcode <> '';
create index if not exists products_brand_idx on public.products(store_id, brand_id);

commit;

-- ===================== 020_allow_negative_stock.sql =====================
-- 020_allow_negative_stock: Cho phép xuất bill khi chưa có tồn kho (bán trước - nhập sau)
-- Sử dụng setting sẵn có store_settings.allow_negative_stock; bật true cho các cửa hàng hiện có.

-- 1) Gỡ CHECK không cho tồn kho âm
alter table public.products drop constraint if exists products_stock_quantity_check;

-- 2) Bật cho phép bán âm tồn kho cho mọi cửa hàng hiện có
insert into public.store_settings (store_id, allow_negative_stock)
select s.id, true from public.stores s
on conflict (store_id) do update set allow_negative_stock = true, updated_at = now();

-- 3) create_sales_order: tôn trọng allow_negative_stock
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

  if p_status = 'paid'::public.order_status
    and not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from public.products p
      join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
      left join public.product_branch_inventory i on i.product_id = p.id and i.branch_id = v_branch_id
      where p.track_inventory and (i.product_id is null or p.stock_quantity < x.quantity or i.quantity - i.reserved < x.quantity)
    ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  select coalesce(sum(x.quantity * x.unit_price), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);

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

-- 4) transition_sales_order: tôn trọng allow_negative_stock
create or replace function public.transition_sales_order(p_order_id uuid, p_status public.order_status) returns void
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
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm mới được cập nhật'; end if;
  if p_status = 'cancelled'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;
  v_discount := coalesce(v_order.discount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Giảm giá không hợp lệ'; end if;
  v_total := v_subtotal - v_discount;

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
      join public.products p on p.id = sold.product_id and p.store_id = v_store_id
      left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
      where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
    ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất bán theo hóa đơn', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = v_order.customer_id and store_id = v_store_id;
  end if;
  update public.orders set status = 'paid'::public.order_status, subtotal = v_subtotal, discount = v_discount, total = v_total, branch_id = v_branch_id, updated_at = now() where id = p_order_id;
end;
$$;

revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric) to authenticated, service_role;
revoke all on function public.transition_sales_order(uuid, public.order_status) from public;
grant execute on function public.transition_sales_order(uuid, public.order_status) to authenticated, service_role;

commit;

-- ===================== 021_edit_sales_order.sql =====================
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

commit;

-- ===================== 022_order_vat_ship.sql =====================
-- 022_order_vat_ship: Them VAT (%), Chiet khau (%), Phi ship cho hoa don
-- orders: them 4 cot; cap nhat 3 ham create/transition/edit de tinh tong = tien hang - chiet khau + vat + phi ship

alter table public.orders add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.orders add column if not exists vat_percent numeric(5,2) not null default 0;
alter table public.orders add column if not exists vat_amount numeric(14,2) not null default 0;
alter table public.orders add column if not exists ship_fee numeric(14,2) not null default 0;

-- Bo overlap signature cu truoc khi tao signature moi
drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb);
drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb, numeric);
drop function if exists public.edit_sales_order(uuid, uuid, text, jsonb, numeric);

-- ============ create_sales_order: them vat/chiet khau/phi ship ============
create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_status public.order_status,
  p_note text,
  p_items jsonb,
  p_discount numeric default 0,
  p_discount_percent numeric default 0,
  p_vat_percent numeric default 0,
  p_ship_fee numeric default 0
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
  v_vat numeric(14,2) := 0;
  v_ship numeric(14,2) := coalesce(p_ship_fee, 0);
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
  if p_discount_percent < 0 or p_discount_percent > 100 or p_vat_percent < 0 or p_vat_percent > 100 then raise exception 'Phần trăm chiết khấu/VAT không hợp lệ'; end if;
  if v_ship < 0 or v_ship > 999999999999.99 then raise exception 'Phí ship không hợp lệ'; end if;

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

  if p_status = 'paid'::public.order_status
    and not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from public.products p
      join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
      left join public.product_branch_inventory i on i.product_id = p.id and i.branch_id = v_branch_id
      where p.track_inventory and (i.product_id is null or p.stock_quantity < x.quantity or i.quantity - i.reserved < x.quantity)
    ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  select coalesce(sum(x.quantity * x.unit_price), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);

  if v_role = 'sales'::public.app_role and v_discount > floor(v_subtotal * 0.10) then
    raise exception 'Nhân viên bán hàng chỉ được giảm giá tối đa 10%% giá trị đơn hàng. Vui lòng nhờ quản lý duyệt.';
  end if;
  if v_discount > v_subtotal then raise exception 'Giảm giá vượt quá tổng tiền hàng'; end if;
  v_vat := round(v_subtotal * coalesce(p_vat_percent, 0) / 100);
  v_total := v_subtotal - v_discount + v_vat + v_ship;

  insert into public.orders(store_id, customer_id, status, subtotal, discount, discount_percent, vat_percent, vat_amount, ship_fee, total, note, branch_id, created_by, updated_at)
  values(v_store_id, p_customer_id, p_status, v_subtotal, v_discount, coalesce(p_discount_percent, 0), coalesce(p_vat_percent, 0), v_vat, v_ship, v_total, nullif(trim(p_note), ''), v_branch_id, v_user_id, now())
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

-- ============ transition_sales_order: tong them vat + phi ship ============
create or replace function public.transition_sales_order(p_order_id uuid, p_status public.order_status) returns void
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
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm mới được cập nhật'; end if;
  if p_status = 'cancelled'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;
  v_discount := coalesce(v_order.discount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Giảm giá không hợp lệ'; end if;
  v_total := v_subtotal - v_discount + coalesce(v_order.vat_amount, 0) + coalesce(v_order.ship_fee, 0);

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
      join public.products p on p.id = sold.product_id and p.store_id = v_store_id
      left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
      where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
    ) then raise exception 'Tồn kho không đủ để hoàn thành hóa đơn'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất bán theo hóa đơn', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = v_order.customer_id and store_id = v_store_id;
  end if;
  update public.orders set status = 'paid'::public.order_status, subtotal = v_subtotal, discount = v_discount, total = v_total, branch_id = v_branch_id, updated_at = now() where id = p_order_id;
end;
$$;

-- ============ edit_sales_order: them vat/chiet khau/phi ship ============
create or replace function public.edit_sales_order(
  p_order_id uuid,
  p_customer_id uuid,
  p_note text,
  p_items jsonb,
  p_discount numeric default 0,
  p_discount_percent numeric default 0,
  p_vat_percent numeric default 0,
  p_ship_fee numeric default 0
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
  v_vat numeric(14,2) := 0;
  v_ship numeric(14,2) := coalesce(p_ship_fee, 0);
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
  if p_discount_percent < 0 or p_discount_percent > 100 or p_vat_percent < 0 or p_vat_percent > 100 then raise exception 'Phần trăm chiết khấu/VAT không hợp lệ'; end if;
  if v_ship < 0 or v_ship > 999999999999.99 then raise exception 'Phí ship không hợp lệ'; end if;
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

  -- 2) Kiểm tra tồn kho cho items MỚI
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
  v_vat := round(v_subtotal * coalesce(p_vat_percent, 0) / 100);
  v_total := v_subtotal - v_discount + v_vat + v_ship;

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

  -- 5) Điều chỉnh tổng mua khách
  v_old_customer_id := v_order.customer_id;
  if v_old_customer_id is not null then
    update public.customers set total_spent = total_spent - v_order.total where id = v_old_customer_id and store_id = v_store_id;
  end if;
  if p_customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = p_customer_id and store_id = v_store_id;
  end if;

  -- 6) Cập nhật hóa đơn
  update public.orders
  set customer_id = p_customer_id, note = nullif(trim(p_note), ''), discount = v_discount, discount_percent = coalesce(p_discount_percent, 0), vat_percent = coalesce(p_vat_percent, 0), vat_amount = v_vat, ship_fee = v_ship, subtotal = v_subtotal, total = v_total, updated_at = now()
  where id = p_order_id;

  return p_order_id;
end;
$$;

revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric, numeric, numeric, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric, numeric, numeric, numeric) to authenticated, service_role;
revoke all on function public.transition_sales_order(uuid, public.order_status) from public;
grant execute on function public.transition_sales_order(uuid, public.order_status) to authenticated, service_role;
revoke all on function public.edit_sales_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric) from public;
grant execute on function public.edit_sales_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric) to authenticated, service_role;

commit;

-- ===================== 023_order_delivering_enum.sql =====================
-- 023_order_delivering_enum: Them trang thai "dang giao" cho don hang.
-- QUAN TRONG: chay RIENG file nay TRUOC file 024 (PostgreSQL khong cho dung
-- gia tri enum vua them trong cung mot transaction).

alter type public.order_status add value if not exists 'delivering';

commit;

-- ===================== 024_order_delivering_debt.sql =====================
-- 024_order_delivering_debt: Luong don "Dang giao" -> "Cong no / Da thanh toan TM" (Hoan thanh)
-- YEU CAU: da chay 023_order_delivering_enum.sql truoc do.
-- Gom:
--   1) Cot public.customers.debt (no khach, chi ham SECURITY DEFINER duoc ghi)
--   2) create_sales_order: cho phep tao don 'delivering' (tru ton kho ngay, chua tinh tong ban)
--   3) transition_sales_order: draft->delivering|paid|cancelled, delivering->paid|cancelled
--      paid tu delivering kem p_payment_method ('cash' | 'debt'), cong no khach khi 'debt'
--   4) customers_by_debt: tinh them no tren don (c.debt)
--   5) collect_customer_debt: thu no khach (tru c.debt)
--   6) cashbook_cancel_voucher: huy phieu thu cong no thi hoan lai no khach

-- ============ 1) Cot no khach ============
alter table public.customers add column if not exists debt numeric(14,2) not null default 0;

-- ============ 2) create_sales_order ============
drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb);
drop function if exists public.create_sales_order(uuid, public.order_status, text, jsonb, numeric);

create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_status public.order_status,
  p_note text,
  p_items jsonb,
  p_discount numeric default 0,
  p_discount_percent numeric default 0,
  p_vat_percent numeric default 0,
  p_ship_fee numeric default 0
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
  v_vat numeric(14,2) := 0;
  v_ship numeric(14,2) := coalesce(p_ship_fee, 0);
  v_total numeric(14,2);
  v_item_count integer;
  v_product_count integer;
  v_branch_id uuid;
begin
  if v_store_id is null or v_user_id is null then raise exception 'Phiên đăng nhập không hợp lệ'; end if;
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền tạo đơn hàng'; end if;
  if p_status not in ('draft'::public.order_status, 'delivering'::public.order_status, 'paid'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Đơn hàng phải có ít nhất một hàng hóa'; end if;
  if v_discount < 0 or v_discount > 999999999999.99 then raise exception 'Giảm giá không hợp lệ'; end if;
  if p_discount_percent < 0 or p_discount_percent > 100 or p_vat_percent < 0 or p_vat_percent > 100 then raise exception 'Phần trăm chiết khấu/VAT không hợp lệ'; end if;
  if v_ship < 0 or v_ship > 999999999999.99 then raise exception 'Phí ship không hợp lệ'; end if;

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

  if p_status in ('delivering'::public.order_status, 'paid'::public.order_status)
    and not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from public.products p
      join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric) on x.product_id = p.id
      left join public.product_branch_inventory i on i.product_id = p.id and i.branch_id = v_branch_id
      where p.track_inventory and (i.product_id is null or p.stock_quantity < x.quantity or i.quantity - i.reserved < x.quantity)
    ) then raise exception 'Tồn kho không đủ để giao hàng'; end if;

  select coalesce(sum(x.quantity * x.unit_price), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric);

  if v_role = 'sales'::public.app_role and v_discount > floor(v_subtotal * 0.10) then
    raise exception 'Nhân viên bán hàng chỉ được giảm giá tối đa 10%% giá trị đơn hàng. Vui lòng nhờ quản lý duyệt.';
  end if;
  if v_discount > v_subtotal then raise exception 'Giảm giá vượt quá tổng tiền hàng'; end if;
  v_vat := round(v_subtotal * coalesce(p_vat_percent, 0) / 100);
  v_total := v_subtotal - v_discount + v_vat + v_ship;

  insert into public.orders(store_id, customer_id, status, subtotal, discount, discount_percent, vat_percent, vat_amount, ship_fee, total, note, branch_id, created_by, updated_at)
  values(v_store_id, p_customer_id, p_status, v_subtotal, v_discount, coalesce(p_discount_percent, 0), coalesce(p_vat_percent, 0), v_vat, v_ship, v_total, nullif(trim(p_note), ''), v_branch_id, v_user_id, now())
  returning id into v_order_id;

  insert into public.order_items(order_id, product_id, quantity, unit_price, affects_inventory, affects_branch_inventory)
  select v_order_id, x.product_id, x.quantity, x.unit_price, p.track_inventory, p.track_inventory
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
  join public.products p on p.id = x.product_id and p.store_id = v_store_id;

  -- Hang da roi kho khi tao don dang giao hoac hoan thanh: tru ton ngay.
  -- Rieng doanh thu (total_spent) chi tinh khi da hoan thanh (paid).
  if p_status in ('delivering'::public.order_status, 'paid'::public.order_status) then
    update public.products p
    set stock_quantity = p.stock_quantity - x.quantity, updated_at = now()
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where p.id = x.product_id and p.store_id = v_store_id and exists(select 1 from public.order_items i where i.order_id = v_order_id and i.product_id = p.id and i.affects_inventory);

    update public.product_branch_inventory i
    set quantity = i.quantity - x.quantity, updated_at = now()
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    where i.product_id = x.product_id and i.branch_id = v_branch_id and exists(select 1 from public.order_items line where line.order_id = v_order_id and line.product_id = i.product_id and line.affects_branch_inventory);

    insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
    select v_store_id, x.product_id, 'sale'::public.movement_type, -x.quantity, v_order_id, 'Xuất kho theo đơn hàng', v_user_id
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, unit_price numeric)
    join public.order_items i on i.order_id = v_order_id and i.product_id = x.product_id and i.affects_inventory;

    if p_status = 'paid'::public.order_status and p_customer_id is not null then
      update public.customers set total_spent = total_spent + v_total where id = p_customer_id and store_id = v_store_id;
    end if;
  end if;

  return v_order_id;
end;
$$;

-- ============ 3) transition_sales_order ============
drop function if exists public.transition_sales_order(uuid, public.order_status);

create function public.transition_sales_order(p_order_id uuid, p_status public.order_status, p_payment_method text default null) returns void
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
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  if v_role not in ('manager'::public.app_role, 'sales'::public.app_role) then raise exception 'Bạn không có quyền cập nhật đơn hàng'; end if;
  if p_status is null or p_status not in ('delivering'::public.order_status, 'paid'::public.order_status, 'cancelled'::public.order_status) then raise exception 'Trạng thái đơn hàng không hợp lệ'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'debt', 'transfer') then raise exception 'Phương thức thanh toán không hợp lệ'; end if;
  select * into v_order from public.orders where id = p_order_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;

  -- Huy PHIEU TAM: khong anh huong ton kho
  if p_status = 'cancelled'::public.order_status and v_order.status = 'draft'::public.order_status then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;

  -- Huy DON DANG GIAO: hoan ton kho da xuat
  if p_status = 'cancelled'::public.order_status and v_order.status = 'delivering'::public.order_status then
    v_branch_id := v_order.branch_id;
    if v_branch_id is null then
      select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    end if;
    update public.products p
    set stock_quantity = p.stock_quantity + sold.quantity, updated_at = now()
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
    where p.id = sold.product_id and p.store_id = v_store_id;
    if v_branch_id is not null then
      update public.product_branch_inventory inventory
      set quantity = inventory.quantity + sold.quantity, updated_at = now()
      from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
      where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
    end if;
    insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
    select v_store_id, sold.product_id, 'return'::public.movement_type, sold.quantity, p_order_id, 'Hoàn tồn khi hủy đơn giao ' || lpad(v_order.order_number::text, 6, '0'), v_user_id
    from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    return;
  end if;

  if p_status = 'cancelled'::public.order_status then raise exception 'Chỉ phiếu tạm hoặc đơn đang giao mới được hủy'; end if;

  -- HOAN THANH tu DON DANG GIAO: ton kho da tru tu luc tao don, chi ghi nhan doanh thu + cong no
  if p_status = 'paid'::public.order_status and v_order.status = 'delivering'::public.order_status then
    if p_payment_method = 'debt' and v_order.customer_id is null then raise exception 'Cần chọn khách hàng để ghi công nợ'; end if;
    if v_order.customer_id is not null then
      update public.customers set total_spent = total_spent + v_order.total where id = v_order.customer_id and store_id = v_store_id;
      if p_payment_method = 'debt' then
        update public.customers set debt = debt + v_order.total where id = v_order.customer_id and store_id = v_store_id;
      end if;
    end if;
    update public.orders set status = 'paid'::public.order_status, payment_method = coalesce(p_payment_method, payment_method), updated_at = now() where id = p_order_id;
    return;
  end if;

  if v_order.status <> 'draft'::public.order_status then raise exception 'Chỉ phiếu tạm hoặc đơn đang giao mới được cập nhật'; end if;

  -- Tu PHIEU TAM -> delivering hoac paid: tru ton kho tai day
  if not exists(select 1 from public.order_items where order_id = p_order_id) then raise exception 'Đơn hàng chưa có hàng hóa'; end if;
  if exists(
    select 1 from public.order_items i
    left join public.products p on p.id = i.product_id and p.store_id = v_store_id and p.active and p.sold_by = 'quantity'
    where i.order_id = p_order_id and p.id is null
  ) then raise exception 'Đơn hàng có hàng hóa không hợp lệ'; end if;
  if v_order.customer_id is not null and not exists(select 1 from public.customers where id = v_order.customer_id and store_id = v_store_id) then raise exception 'Khách hàng không thuộc cửa hàng'; end if;
  if v_order.customer_id is null and p_status = 'paid'::public.order_status and p_payment_method = 'debt' then raise exception 'Cần chọn khách hàng để ghi công nợ'; end if;
  if exists(select 1 from public.order_items where order_id = p_order_id and (quantity <= 0 or unit_price not between 0 and 999999999999.99)) then raise exception 'Chi tiết hàng hóa không hợp lệ'; end if;
  select sum(line_total) into v_subtotal from public.order_items where order_id = p_order_id;
  if v_subtotal is null or v_subtotal not between 0 and 999999999999.99 then raise exception 'Tổng tiền đơn hàng không hợp lệ'; end if;
  v_discount := coalesce(v_order.discount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Giảm giá không hợp lệ'; end if;
  v_total := v_subtotal - v_discount + coalesce(v_order.vat_amount, 0) + coalesce(v_order.ship_fee, 0);

  v_branch_id := v_order.branch_id;
  if v_branch_id is null then
    select id into v_branch_id from public.store_branches where store_id = v_store_id and active order by is_default desc, created_at limit 1;
    if v_branch_id is null then raise exception 'Cửa hàng chưa có chi nhánh hoạt động'; end if;
  end if;
  update public.order_items set affects_branch_inventory = affects_inventory where order_id = p_order_id;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id where i.order_id = p_order_id and p.store_id = v_store_id for update of p;
  perform inventory.product_id from public.product_branch_inventory inventory join public.order_items i on i.product_id = inventory.product_id where i.order_id = p_order_id and i.affects_branch_inventory and inventory.branch_id = v_branch_id for update of inventory;

  if not coalesce((select s.allow_negative_stock from public.store_settings s where s.store_id = v_store_id), false)
    and exists(
      select 1
      from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
      join public.products p on p.id = sold.product_id and p.store_id = v_store_id
      left join public.product_branch_inventory inventory on inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id
      where inventory.product_id is null or p.stock_quantity < sold.quantity or inventory.quantity - inventory.reserved < sold.quantity
    ) then raise exception 'Tồn kho không đủ để giao hàng'; end if;

  update public.products p
  set stock_quantity = p.stock_quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold
  where p.id = sold.product_id and p.store_id = v_store_id;
  update public.product_branch_inventory inventory
  set quantity = inventory.quantity - sold.quantity, updated_at = now()
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_branch_inventory group by product_id) sold
  where inventory.product_id = sold.product_id and inventory.branch_id = v_branch_id;
  insert into public.inventory_movements(store_id, product_id, type, quantity, reference_id, note, created_by)
  select v_store_id, sold.product_id, 'sale'::public.movement_type, -sold.quantity, p_order_id, 'Xuất kho theo đơn hàng', v_user_id
  from (select product_id, sum(quantity) as quantity from public.order_items where order_id = p_order_id and affects_inventory group by product_id) sold;

  if p_status = 'paid'::public.order_status and v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + v_total where id = v_order.customer_id and store_id = v_store_id;
    if p_payment_method = 'debt' then
      update public.customers set debt = debt + v_total where id = v_order.customer_id and store_id = v_store_id;
    end if;
  end if;
  update public.orders set status = p_status, subtotal = v_subtotal, discount = v_discount, total = v_total, branch_id = v_branch_id, payment_method = coalesce(p_payment_method, payment_method), updated_at = now() where id = p_order_id;
end;
$$;

-- ============ 4) customers_by_debt: tinh them no tren don ============
drop function if exists public.customers_by_debt(numeric, numeric);

create function public.customers_by_debt(p_min numeric, p_max numeric)
returns table(customer_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id as customer_id
  from public.customers c
  left join (
    select o.customer_id, sum(greatest(0, s.cod_amount - s.collected_cod)) as cod_debt
    from public.orders o
    join public.shipments s on s.order_id = o.id and s.status <> 'cancelled'
    where o.status not in ('draft', 'cancelled', 'refunded')
    group by o.customer_id
  ) d on d.customer_id = c.id
  where coalesce(d.cod_debt, 0) + coalesce(c.debt, 0)
        between coalesce(p_min, -1e12) and coalesce(p_max, 1e12)
$$;

-- ============ 5) collect_customer_debt: thu no khach ============
create or replace function public.collect_customer_debt(p_customer_id uuid, p_amount numeric) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền thu công nợ'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 then raise exception 'Số tiền thu không hợp lệ'; end if;
  update public.customers set debt = debt - p_amount where id = p_customer_id and store_id = v_store_id;
  if not found then raise exception 'Không tìm thấy khách hàng'; end if;
end;
$$;

-- ============ 6) cashbook_cancel_voucher: hoan no khi huy phieu thu cong no ============
create or replace function public.cashbook_cancel_voucher(p_voucher_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.current_store_id();
  v_user_id uuid := auth.uid();
  v_voucher public.cash_vouchers%rowtype;
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền hủy phiếu'; end if;
  select * into v_voucher from public.cash_vouchers where id = p_voucher_id and store_id = v_store_id for update;
  if not found then raise exception 'Không tìm thấy phiếu'; end if;
  if v_voucher.status <> 'completed' then raise exception 'Chỉ phiếu chưa hủy mới được hủy'; end if;
  if v_voucher.type = 'receipt' and v_voucher.kind = 'debt_collection' and v_voucher.partner_kind = 'customer' and v_voucher.partner_id is not null then
    update public.customers set debt = debt + v_voucher.amount where id = v_voucher.partner_id and store_id = v_store_id;
  end if;
  update public.cash_vouchers
  set status = 'cancelled', cancelled_by = v_user_id, cancelled_at = now(), updated_at = now()
  where id = p_voucher_id and store_id = v_store_id;
end;
$$;

-- ============ Grants ============
revoke all on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric, numeric, numeric, numeric) from public;
grant execute on function public.create_sales_order(uuid, public.order_status, text, jsonb, numeric, numeric, numeric, numeric) to authenticated, service_role;
revoke all on function public.transition_sales_order(uuid, public.order_status, text) from public;
grant execute on function public.transition_sales_order(uuid, public.order_status, text) to authenticated, service_role;
revoke all on function public.customers_by_debt(numeric, numeric) from public;
grant execute on function public.customers_by_debt(numeric, numeric) to authenticated, service_role;
revoke all on function public.collect_customer_debt(uuid, numeric) from public;
grant execute on function public.collect_customer_debt(uuid, numeric) to authenticated, service_role;
revoke all on function public.cashbook_cancel_voucher(uuid) from public;
grant execute on function public.cashbook_cancel_voucher(uuid) to authenticated, service_role;

commit;

