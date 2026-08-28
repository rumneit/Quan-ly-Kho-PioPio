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
