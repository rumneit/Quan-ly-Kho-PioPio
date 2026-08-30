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