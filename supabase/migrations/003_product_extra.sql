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
