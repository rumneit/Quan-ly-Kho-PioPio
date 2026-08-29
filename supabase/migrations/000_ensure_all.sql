-- =====================================================================
-- ENSURE-ALL: 001 → 011 (idempotent) — chạy an toàn nhiều lần
-- Bổ sung bất kỳ đối tượng nào còn thiếu; không xóa/sửa dữ liệu hiện có.
-- =====================================================================

-- ---------- TYPES (001) ----------
do $$ begin
  create type public.app_role as enum ('manager','sales');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('draft','paid','cancelled','refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.movement_type as enum ('initial','purchase','sale','adjustment','return');
exception when duplicate_object then null; end $$;

-- ---------- CORE TABLES (001) ----------
create table if not exists public.stores (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, store_id uuid not null references public.stores(id) on delete cascade, username citext not null unique, full_name text not null, role public.app_role not null default 'sales', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.products (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, sku citext not null, name text not null, price numeric(14,2) not null check (price >= 0), cost numeric(14,2) not null default 0 check (cost >= 0), stock_quantity integer not null default 0 check (stock_quantity >= 0), active boolean not null default true, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id, sku));
create table if not exists public.customers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, phone text, email text, total_spent numeric(14,2) not null default 0, created_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table if not exists public.orders (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, order_number bigint generated always as identity, customer_id uuid references public.customers(id), status public.order_status not null default 'draft', subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, total numeric(14,2) not null default 0, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid not null references public.products(id), quantity integer not null check (quantity > 0), unit_price numeric(14,2) not null check (unit_price >= 0), line_total numeric(14,2) generated always as (quantity * unit_price) stored);
create table if not exists public.inventory_movements (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, product_id uuid not null references public.products(id), type public.movement_type not null, quantity integer not null check (quantity <> 0), reference_id uuid, note text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());

-- ---------- FUNCTIONS (001) ----------
create or replace function public.current_store_id() returns uuid language sql stable security definer set search_path = '' as $$ select store_id from public.profiles where id = auth.uid() and active = true $$;
create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = auth.uid() and active = true $$;

-- ---------- PRODUCT FILTERS (002) ----------
create table if not exists public.product_categories (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, parent_id uuid references public.product_categories(id) on delete set null, name text not null, description text, created_at timestamptz not null default now(), unique(store_id, name));
create table if not exists public.suppliers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, created_at timestamptz not null default now(), unique(store_id, name));
alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.products add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.products add column if not exists product_type text not null default 'product';
alter table public.products add column if not exists direct_sale boolean not null default true;
alter table public.products add column if not exists linked_sale_channel boolean not null default false;
alter table public.products add column if not exists expected_out_of_stock_at date;

-- ---------- PRODUCT EXTRA (003) ----------
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists min_stock integer;
alter table public.products add column if not exists max_stock integer;
alter table public.products add column if not exists location text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists track_inventory boolean not null default true;
alter table public.products add column if not exists images jsonb;

-- ---------- PRODUCT CATALOG (004) ----------
create table if not exists public.product_brands (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, description text, created_at timestamptz not null default now(), unique(store_id, name));
create table if not exists public.store_branches (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, is_default boolean not null default false, active boolean not null default true, created_at timestamptz not null default now(), unique(store_id, name));
insert into public.store_branches (store_id, name, is_default) select id, 'Chi nhánh trung tâm', true from public.stores s where not exists (select 1 from public.store_branches b where b.store_id = s.id);
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists brand_id uuid references public.product_brands(id) on delete set null;
alter table public.products add column if not exists base_unit text not null default 'Cái';
alter table public.products add column if not exists sold_by text not null default 'quantity';
alter table public.products add column if not exists weight numeric(14,3);
alter table public.products add column if not exists warranty_months integer not null default 0;
create table if not exists public.product_branch_inventory (product_id uuid not null references public.products(id) on delete cascade, branch_id uuid not null references public.store_branches(id) on delete cascade, quantity numeric(14,3) not null default 0, reserved numeric(14,3) not null default 0, min_stock numeric(14,3), max_stock numeric(14,3), location text, updated_at timestamptz not null default now(), primary key(product_id, branch_id));
create table if not exists public.product_components (product_id uuid not null references public.products(id) on delete cascade, component_id uuid not null references public.products(id) on delete cascade, quantity numeric(14,3) not null default 1 check (quantity > 0), primary key(product_id, component_id));
create table if not exists public.product_import_jobs (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, file_name text, inserted integer not null default 0, updated integer not null default 0, skipped integer not null default 0, errors jsonb not null default '[]'::jsonb, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
-- Tồn kho chi nhánh cho sản phẩm chưa có phân bổ
insert into public.product_branch_inventory(product_id, branch_id, quantity)
select p.id, b.id, p.stock_quantity from public.products p
join lateral (select id from public.store_branches where store_id = p.store_id and active order by is_default desc, created_at limit 1) b on true
where p.track_inventory and not exists (select 1 from public.product_branch_inventory i where i.product_id = p.id)
on conflict(product_id, branch_id) do nothing;

-- ---------- VOUCHER MODULES (005) ----------
create table if not exists public.stocktake_vouchers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, code text not null, status text not null default 'draft', note text, total_actual numeric(14,3) not null default 0, total_adjustment numeric(14,3) not null default 0, adjustment_value numeric(14,2) not null default 0, increase_qty numeric(14,3) not null default 0, decrease_qty numeric(14,3) not null default 0, actual_count integer not null default 0, balanced_at timestamptz, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(store_id, code));
create table if not exists public.stocktake_lines (id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.stocktake_vouchers(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, system_qty numeric(14,3) not null default 0, actual_qty numeric(14,3) not null default 0, diff_qty numeric(14,3) generated always as (actual_qty - system_qty) stored, unit_cost numeric(14,2) not null default 0, diff_value numeric(14,2) generated always as ((actual_qty - system_qty) * unit_cost) stored);
create table if not exists public.internal_use_vouchers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, code text not null, status text not null default 'draft', purpose text, receiver text, note text, total_value numeric(14,2) not null default 0, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(store_id, code));
create table if not exists public.internal_use_lines (id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.internal_use_vouchers(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, quantity numeric(14,3) not null default 1, unit_cost numeric(14,2) not null default 0, value numeric(14,2) not null default 0);
create table if not exists public.damage_vouchers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, code text not null, status text not null default 'draft', reason text, note text, total_value numeric(14,2) not null default 0, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(store_id, code));
create table if not exists public.damage_lines (id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.damage_vouchers(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, quantity numeric(14,3) not null default 1, unit_cost numeric(14,2) not null default 0, value numeric(14,2) not null default 0);

-- ---------- PURCHASING (006) ----------
alter table public.suppliers add column if not exists code text;
alter table public.suppliers add column if not exists phone text;
alter table public.suppliers add column if not exists email text;
alter table public.suppliers add column if not exists address text;
alter table public.suppliers add column if not exists area text;
alter table public.suppliers add column if not exists group_name text;
alter table public.suppliers add column if not exists company text;
alter table public.suppliers add column if not exists tax_code text;
alter table public.suppliers add column if not exists identity text;
alter table public.suppliers add column if not exists note text;
alter table public.suppliers add column if not exists active boolean not null default true;
alter table public.suppliers add column if not exists created_by uuid references public.profiles(id);
create unique index if not exists suppliers_store_code_uq on public.suppliers(store_id, code) where code is not null and code <> '';
create table if not exists public.purchase_vouchers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, code text not null, status text not null default 'draft', supplier_id uuid references public.suppliers(id) on delete set null, branch text, handler text, invoice_number text, note text, total_qty numeric(14,3) not null default 0, item_count integer not null default 0, subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, payable numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(store_id, code));
create table if not exists public.purchase_lines (id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.purchase_vouchers(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, quantity numeric(14,3) not null default 0, cost numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, value numeric(14,2) not null default 0);
create table if not exists public.purchase_return_vouchers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, code text not null, status text not null default 'draft', purchase_id uuid references public.purchase_vouchers(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, branch text, handler text, note text, total_qty numeric(14,3) not null default 0, item_count integer not null default 0, subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, payable numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, refund_type text not null default 'debt', created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(store_id, code));
create table if not exists public.purchase_return_lines (id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.purchase_return_vouchers(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, quantity numeric(14,3) not null default 0, cost numeric(14,2) not null default 0, return_price numeric(14,2) not null default 0, value numeric(14,2) not null default 0);

-- ---------- SALES / SHIPPING (007) ----------
alter table public.orders add column if not exists note text;
alter table public.orders add column if not exists channel text not null default 'direct';
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists branch_id uuid references public.store_branches(id) on delete set null;
alter table public.customers add column if not exists customer_number bigint generated by default as identity;
alter table public.order_items add column if not exists affects_inventory boolean;
alter table public.order_items add column if not exists affects_branch_inventory boolean;
update public.order_items set affects_branch_inventory = false where affects_branch_inventory is null;
alter table public.order_items alter column affects_inventory set default true;
alter table public.order_items alter column affects_inventory set not null;
alter table public.order_items alter column affects_branch_inventory set default false;
alter table public.order_items alter column affects_branch_inventory set not null;
create table if not exists public.sales_returns (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, return_number bigint generated always as identity, order_id uuid not null references public.orders(id) on delete restrict, status text not null default 'completed', subtotal numeric(14,2) not null default 0, refund_amount numeric(14,2) not null default 0, note text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id, order_id));
create table if not exists public.sales_return_items (id uuid primary key default gen_random_uuid(), return_id uuid not null references public.sales_returns(id) on delete cascade, product_id uuid not null references public.products(id), quantity integer not null check (quantity > 0), unit_price numeric(14,2) not null check (unit_price between 0 and 999999999999.99), line_total numeric(14,2) generated always as (quantity * unit_price) stored);
create table if not exists public.delivery_partners (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, partner_number bigint generated always as identity, name text not null, phone text, active boolean not null default true, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id, name));
create table if not exists public.shipments (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, shipment_number bigint generated always as identity, order_id uuid not null references public.orders(id) on delete restrict, partner_id uuid references public.delivery_partners(id) on delete set null, status text not null default 'pending_pickup', receiver_name text not null, receiver_phone text, address text, area text, service text, cod_amount numeric(14,2) not null default 0, collected_cod numeric(14,2) not null default 0, shipping_fee numeric(14,2) not null default 0, partner_fee numeric(14,2) not null default 0, note text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), delivery_at timestamptz, completed_at timestamptz, updated_at timestamptz not null default now(), unique(store_id, order_id));
create table if not exists public.shipment_status_history (id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade, status text not null, note text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());

-- ---------- CUSTOMERS / CASHBOOK (008) ----------
create table if not exists public.customer_groups (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id, name));
alter table public.customers add column if not exists group_id uuid references public.customer_groups(id) on delete set null;
alter table public.customers add column if not exists secondary_phone text;
alter table public.customers add column if not exists birthday date;
alter table public.customers add column if not exists gender text;
alter table public.customers add column if not exists customer_type text not null default 'individual';
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
create table if not exists public.cash_accounts (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, account_type text not null check (account_type in ('cash','bank','ewallet')), opening_balance numeric(14,2) not null default 0, bank_name text, bank_account text, active boolean not null default true, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id, name));
create table if not exists public.cash_vouchers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, voucher_number bigint generated always as identity, account_id uuid not null references public.cash_accounts(id) on delete restrict, type text not null check (type in ('receipt','expense')), kind text not null, amount numeric(14,2) not null check (amount > 0), partner_kind text check (partner_kind in ('customer','supplier')), partner_id uuid, partner_name text, note text, affects_profit boolean not null default true, status text not null default 'completed', occurred_at timestamptz not null default now(), created_by uuid not null references public.profiles(id), cancelled_by uuid references public.profiles(id), cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
-- seed quỹ mặc định + nhóm validate trigger
insert into public.cash_accounts(store_id, name, account_type, opening_balance, created_by)
select s.id, seed.name, seed.account_type, 0, p.id from public.stores s
cross join (values ('Tiền mặt','cash'),('Ngân hàng','bank'),('Ví điện tử','ewallet')) as seed(name, account_type)
left join lateral (select id from public.profiles where store_id = s.id order by created_at limit 1) owner2 on true
left join lateral (select id from public.profiles where store_id = s.id order by created_at limit 1) p on true
where not exists (select 1 from public.cash_accounts a where a.store_id = s.id and a.account_type = seed.account_type);

-- ---------- SETTINGS (009) ----------
create table if not exists public.store_settings (store_id uuid primary key references public.stores(id) on delete cascade, cost_method text not null default 'average' check (cost_method in ('fixed','average')), track_lot_expiry boolean not null default false, manufacturing_enabled boolean not null default false, allow_change_transaction_time boolean not null default false, allow_negative_stock boolean not null default false, working_time_band smallint not null default 1 check (working_time_band between 0 and 3), currency text not null default 'VND', updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id));
insert into public.store_settings(store_id) select s.id from public.stores s where not exists (select 1 from public.store_settings ss where ss.store_id = s.id);
create table if not exists public.user_product_group_permissions (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, category_id uuid not null references public.product_categories(id) on delete cascade, granted_by uuid not null references public.profiles(id), granted_at timestamptz not null default now(), unique (user_id, category_id));
create table if not exists public.audit_log (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, actor_id uuid references public.profiles(id), action text not null, entity text not null, entity_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.book_periods (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, period_start date not null, period_end date not null, locked_at timestamptz not null default now(), locked_by uuid not null references public.profiles(id), note text, unique (store_id, period_start, period_end), check (period_end >= period_start));
create table if not exists public.print_templates (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, type text not null check (type in ('invoice','order','return','purchase','stocktake')), name text not null, paper_size text not null default 'A4', copies smallint not null default 1, show_logo boolean not null default true, show_store_info boolean not null default true, show_tax boolean not null default true, footer_note text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (store_id, type, name));
create table if not exists public.devices (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, kind text not null check (kind in ('scanner','printer','scale','pos','other')), identifier text not null, paired_by uuid not null references public.profiles(id), paired_at timestamptz not null default now(), last_seen_at timestamptz, active boolean not null default true);

-- ---------- SETTINGS EXTRAS (010) ----------
create table if not exists public.api_tokens (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, scopes text not null default 'read', token_hash text not null, token_prefix text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), last_used_at timestamptz, expires_at timestamptz, active boolean not null default true);
create table if not exists public.currency_exchange_rates (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, currency text not null, rate numeric(14,4) not null default 1 check (rate > 0), updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id), unique (store_id, currency));
insert into public.currency_exchange_rates(store_id, currency, rate) select s.id, 'VND', 1 from public.stores s where not exists (select 1 from public.currency_exchange_rates r where r.store_id = s.id and r.currency = 'VND');

-- ---------- DATA DELETION RPC (011) ----------
create or replace function public.delete_store_transactions(p_store_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
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
end; $$;
create or replace function public.delete_store_all_data(p_store_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() is distinct from 'manager'::public.app_role then raise exception 'Bạn không có quyền thực hiện thao tác này'; end if;
  if p_store_id is distinct from public.current_store_id() then raise exception 'Cửa hàng không hợp lệ'; end if;
  perform public.delete_store_transactions(p_store_id);
  delete from public.purchase_return_lines where voucher_id in (select id from public.purchase_return_vouchers where store_id = p_store_id);
  delete from public.purchase_return_vouchers where store_id = p_store_id;
  delete from public.purchase_lines where voucher_id in (select id from public.purchase_vouchers where store_id = p_store_id);
  delete from public.purchase_vouchers where store_id = p_store_id;
  delete from public.product_branch_inventory where branch_id in (select id from public.store_branches where store_id = p_store_id);
  delete from public.product_components where product_id in (select id from public.products where store_id = p_store_id) or component_id in (select id from public.products where store_id = p_store_id);
  delete from public.user_product_group_permissions where store_id = p_store_id;
  delete from public.products where store_id = p_store_id;
  delete from public.customers where store_id = p_store_id;
  delete from public.suppliers where store_id = p_store_id;
  delete from public.delivery_partners where store_id = p_store_id;
  return 1;
end; $$;
revoke all on function public.delete_store_transactions(uuid) from public;
revoke all on function public.delete_store_all_data(uuid) from public;
grant execute on function public.delete_store_transactions(uuid) to authenticated, service_role;
grant execute on function public.delete_store_all_data(uuid) to authenticated, service_role;

-- ---------- INDEXES ----------
create index if not exists products_store_idx on public.products(store_id);
create index if not exists customers_store_idx on public.customers(store_id);
create index if not exists orders_store_created_idx on public.orders(store_id, created_at desc);
create index if not exists inventory_store_product_idx on public.inventory_movements(store_id, product_id);
create index if not exists product_categories_store_idx on public.product_categories(store_id);
create index if not exists suppliers_store_idx on public.suppliers(store_id);
create index if not exists products_category_idx on public.products(store_id, category_id);
create index if not exists products_brand_idx on public.products(store_id, brand_id);
create index if not exists sales_returns_store_created_idx on public.sales_returns(store_id, created_at desc);
create index if not exists sales_return_items_return_idx on public.sales_return_items(return_id);
create index if not exists delivery_partners_store_name_idx on public.delivery_partners(store_id, name);
create index if not exists shipments_store_created_idx on public.shipments(store_id, created_at desc);
create index if not exists shipments_partner_status_idx on public.shipments(store_id, partner_id, status);
create index if not exists shipment_history_shipment_idx on public.shipment_status_history(shipment_id, created_at);
create index if not exists customers_store_number_idx on public.customers(store_id, customer_number desc);
create index if not exists customers_store_group_idx on public.customers(store_id, group_id);
create index if not exists customers_store_name_idx on public.customers(store_id, lower(name));
create index if not exists customers_store_phone_idx on public.customers(store_id, phone);
create index if not exists cash_accounts_store_type_idx on public.cash_accounts(store_id, account_type);
create index if not exists cash_vouchers_store_occurred_idx on public.cash_vouchers(store_id, occurred_at desc);
create index if not exists cash_vouchers_store_account_idx on public.cash_vouchers(store_id, account_id);
create index if not exists cash_vouchers_store_partner_idx on public.cash_vouchers(store_id, partner_kind, partner_id);
create index if not exists upgp_user_idx on public.user_product_group_permissions(user_id);
create index if not exists upgp_category_idx on public.user_product_group_permissions(category_id);
create index if not exists audit_log_store_created_idx on public.audit_log(store_id, created_at desc);
create index if not exists book_periods_store_idx on public.book_periods(store_id, period_end desc);
create index if not exists devices_store_idx on public.devices(store_id);
create index if not exists api_tokens_store_idx on public.api_tokens(store_id, created_at desc);

-- ---------- GRANTS ----------
grant usage, select on all sequences in schema public to authenticated, service_role;
grant select on public.stores, public.profiles, public.products, public.customers, public.orders, public.order_items, public.inventory_movements, public.product_categories, public.suppliers, public.product_brands, public.store_branches, public.product_branch_inventory, public.product_components, public.product_import_jobs, public.stocktake_vouchers, public.stocktake_lines, public.internal_use_vouchers, public.internal_use_lines, public.damage_vouchers, public.damage_lines, public.purchase_vouchers, public.purchase_lines, public.purchase_return_vouchers, public.purchase_return_lines, public.sales_returns, public.sales_return_items, public.delivery_partners, public.shipments, public.shipment_status_history, public.customer_groups, public.cash_accounts, public.cash_vouchers, public.store_settings, public.user_product_group_permissions, public.audit_log, public.book_periods, public.print_templates, public.devices, public.api_tokens, public.currency_exchange_rates to authenticated;
grant execute on function public.current_store_id() to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;