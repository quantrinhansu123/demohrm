-- Chốt tháng tạm ứng. Chạy trong schema trangway.
create table if not exists trangway.advance_month_closes (
  month_code  varchar(7) primary key,
  closed_at   timestamptz not null default now(),
  closed_by   bigint references trangway.staff(id) on delete set null,
  note        text,
  constraint advance_month_closes_month_chk check (month_code ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

alter table trangway.advance_month_closes disable row level security;

grant select, insert, update, delete on trangway.advance_month_closes
  to anon, authenticated, service_role;

create index if not exists idx_advance_month_closes_closed_at
  on trangway.advance_month_closes (closed_at desc);
