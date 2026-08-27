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

create policy "authenticated upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "public view product images" on storage.objects for select to public using (bucket_id = 'product-images');
create policy "authenticated update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images');
create policy "authenticated delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');
