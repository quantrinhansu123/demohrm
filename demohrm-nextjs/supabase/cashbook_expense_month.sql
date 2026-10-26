-- Tháng chi + người nhận (CN/NS) cho sổ chi. Chạy một lần trên Supabase sau cashbook_entries.sql.

alter table trangway.cashbook_entries
  add column if not exists expense_month varchar(7);

update trangway.cashbook_entries
   set expense_month = to_char(entry_date, 'YYYY-MM')
 where expense_month is null;

alter table trangway.cashbook_entries
  alter column expense_month set not null;

alter table trangway.cashbook_entries
  drop constraint if exists cashbook_entries_expense_month_chk;
alter table trangway.cashbook_entries
  add constraint cashbook_entries_expense_month_chk
  check (expense_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table trangway.cashbook_entries
  add column if not exists worker_id bigint references trangway.workers(id) on delete set null;

alter table trangway.cashbook_entries
  add column if not exists staff_id bigint references trangway.staff(id) on delete set null;

alter table trangway.cashbook_entries
  drop constraint if exists cashbook_entries_payee_chk;
alter table trangway.cashbook_entries
  add constraint cashbook_entries_payee_chk
  check (
    (worker_id is null and staff_id is null)
    or (worker_id is not null and staff_id is null)
    or (worker_id is null and staff_id is not null)
  );

create index if not exists idx_cashbook_expense_month
  on trangway.cashbook_entries (expense_month);

create index if not exists idx_cashbook_group_month
  on trangway.cashbook_entries (group_code, expense_month);

create index if not exists idx_cashbook_worker
  on trangway.cashbook_entries (worker_id)
  where worker_id is not null;

create index if not exists idx_cashbook_staff
  on trangway.cashbook_entries (staff_id)
  where staff_id is not null;

-- Chốt tháng chi (theo dõi; vẫn thêm/sửa/xóa được).
create table if not exists trangway.cashbook_month_closes (
  month_code  varchar(7) primary key,
  closed_at   timestamptz not null default now(),
  closed_by   bigint references trangway.staff(id) on delete set null,
  note        text,
  constraint cashbook_month_closes_month_chk check (month_code ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

alter table trangway.cashbook_month_closes disable row level security;

grant select, insert, update, delete on trangway.cashbook_month_closes
  to anon, authenticated, service_role;

create index if not exists idx_cashbook_month_closes_closed_at
  on trangway.cashbook_month_closes (closed_at desc);

-- Thống kê theo tháng chi (tránh quét toàn bộ rows ở API).
create or replace function trangway.fn_cashbook_month_stats()
returns table (
  expense_month varchar(7),
  entry_count bigint,
  total_amount numeric,
  weekly_wage numeric,
  office numeric
)
language sql
stable
security definer
set search_path = trangway, public
as $$
  select
    ce.expense_month,
    count(*)::bigint as entry_count,
    coalesce(sum(ce.amount), 0) as total_amount,
    coalesce(sum(case when ce.group_code in ('weekly_wage', 'advance') then ce.amount else 0 end), 0) as weekly_wage,
    coalesce(sum(case when ce.group_code not in ('weekly_wage', 'advance') then ce.amount else 0 end), 0) as office
  from trangway.cashbook_entries ce
  group by ce.expense_month;
$$;

grant execute on function trangway.fn_cashbook_month_stats()
  to anon, authenticated, service_role;
