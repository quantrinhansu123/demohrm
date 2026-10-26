-- Tháng kế toán tạm ứng (lọc theo tháng, độc lập ngày chi).
-- Chạy một lần trên Supabase sau advances.sql.

alter table trangway.advances
  add column if not exists advance_month varchar(7);

update trangway.advances
   set advance_month = to_char(advance_date, 'YYYY-MM')
 where advance_month is null;

alter table trangway.advances
  alter column advance_month set not null;

alter table trangway.advances
  drop constraint if exists advances_month_chk;
alter table trangway.advances
  add constraint advances_month_chk
  check (advance_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

create index if not exists idx_advances_month
  on trangway.advances (advance_month);

create index if not exists idx_advances_status_month
  on trangway.advances (status, advance_month);
