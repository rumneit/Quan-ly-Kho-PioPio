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

