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
