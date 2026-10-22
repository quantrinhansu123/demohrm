-- Chi tạm ứng + ghi sổ chi. Chạy sau cashbook_entries.sql và advances.sql.
create or replace function trangway.fn_pay_advance(
  p_advance_id bigint,
  p_staff_id bigint
)
returns json
language plpgsql
security definer
set search_path = trangway, public
as $$
declare
  v_advance trangway.advances%rowtype;
  v_name text;
  v_company text;
  v_cashbook_id bigint;
begin
  select *
    into v_advance
    from trangway.advances
   where id = p_advance_id
   for update;

  if not found then
    raise exception 'advance_not_found' using errcode = 'P0002';
  end if;

  if v_advance.status not in ('approved', 'paid') then
    raise exception 'advance_not_approved' using errcode = 'P0001';
  end if;

  if v_advance.status = 'paid' then
    return json_build_object(
      'id', v_advance.id,
      'code', v_advance.code,
      'status', v_advance.status,
      'cashbook_entry_id', v_advance.cashbook_entry_id
    );
  end if;

  if v_advance.subject_type = 'staff' then
    select s.full_name, 'Trang Way'
      into v_name, v_company
      from trangway.staff s
     where s.id = v_advance.staff_id;
  else
    select w.full_name, coalesce(c.short_name, '')
      into v_name, v_company
      from trangway.workers w
      left join trangway.companies c on c.id = w.current_company_id
     where w.id = v_advance.worker_id;
  end if;

  insert into trangway.cashbook_entries
    (entry_date, content, full_name, company_name, amount, note, group_code)
  values
    (v_advance.advance_date,
     'Tạm ứng ' || v_advance.code || ' - ' || coalesce(v_advance.reason, ''),
     v_name,
     v_company,
     v_advance.amount,
     v_advance.reason,
     'advance')
  returning id into v_cashbook_id;

  update trangway.advances
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         approved_by = coalesce(approved_by, p_staff_id),
         cashbook_entry_id = v_cashbook_id,
         updated_at = now()
   where id = v_advance.id;

  return json_build_object(
    'id', v_advance.id,
    'code', v_advance.code,
    'status', 'paid',
    'cashbook_entry_id', v_cashbook_id
  );
end;
$$;

grant execute on function trangway.fn_pay_advance(bigint, bigint)
  to anon, authenticated, service_role;
