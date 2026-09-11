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
