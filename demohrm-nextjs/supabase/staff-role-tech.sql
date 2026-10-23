-- Bổ sung role 'tech' (Kỹ thuật) vào enum staff_role.
-- Chạy một lần trong Supabase SQL Editor TRƯỚC khi chuyển nhân sự sang phòng Kỹ thuật.
-- Không chạy cùng transaction với câu UPDATE dùng giá trị 'tech'.
do $$
declare
  type_schema text;
  type_name text;
begin
  select tn.nspname, t.typname
    into type_schema, type_name
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace tn on tn.oid = t.typnamespace
  where n.nspname = 'trangway'
    and c.relname = 'staff'
    and a.attname = 'role'
    and not a.attisdropped;

  if type_name is null then
    raise exception 'Không tìm thấy cột trangway.staff.role';
  end if;

  execute format('alter type %I.%I add value if not exists %L', type_schema, type_name, 'tech');
end
$$;
