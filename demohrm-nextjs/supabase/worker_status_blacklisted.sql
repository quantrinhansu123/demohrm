-- Thêm giá trị blacklisted vào workers.status (ENUM Postgres).
-- Lỗi UI: "Giá trị không nằm trong danh mục cho phép." (code 22P02)
-- Chạy từng bước trong Supabase SQL editor (schema trangway).

-- Bước 1: xem tên ENUM của cột status
select
  n.nspname || '.' || t.typname as enum_type,
  array_agg(e.enumlabel order by e.enumsortorder) as values
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace ns on ns.oid = c.relnamespace
join pg_type t on t.oid = a.atttypid
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where ns.nspname = 'trangway'
  and c.relname = 'workers'
  and a.attname = 'status'
  and t.typtype = 'e'
group by n.nspname, t.typname;

-- Bước 2: thêm blacklisted (đổi tên ENUM nếu Bước 1 khác).
-- Các tên hay gặp — chạy dòng khớp Bước 1; IF NOT EXISTS an toàn nếu đã có.
alter type trangway.worker_status add value if not exists 'blacklisted';
-- alter type trangway.workers_status add value if not exists 'blacklisted';
-- alter type trangway.employment_status add value if not exists 'blacklisted';

-- Bước 3 (chỉ khi status là text + CHECK, không phải ENUM): bỏ qua nếu Bước 1 có kết quả.
do $$
declare
  r record;
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where ns.nspname = 'trangway'
      and c.relname = 'workers'
      and a.attname = 'status'
      and t.typtype = 'e'
  ) then
    raise notice 'status is ENUM — skip CHECK migration';
    return;
  end if;

  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'trangway'
      and rel.relname = 'workers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
      and pg_get_constraintdef(con.oid) ilike '%working%'
      and pg_get_constraintdef(con.oid) not ilike '%blacklisted%'
  loop
    execute format('alter table trangway.workers drop constraint %I', r.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'trangway' and rel.relname = 'workers' and con.conname = 'workers_status_chk'
  ) then
    alter table trangway.workers
      add constraint workers_status_chk
      check (status in (
        'working','waiting_start','on_leave','resigned','no_show','candidate','blacklisted'
      ));
  end if;
end $$;
