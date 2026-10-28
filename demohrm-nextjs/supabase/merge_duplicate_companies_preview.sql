-- Chỉ đọc — xem các công ty sẽ bị gộp trước khi chạy merge_duplicate_companies.sql
with keys(group_key) as (
  values
    ('compal bt1'),
    ('hrp - bình xuyên 2'),
    ('jawa - kcn khai quang'),
    ('jawa - kcn khai quang - thời vụ'),
    ('minda'),
    ('ojitex'),
    ('ojtex thăng long 3'),
    ('star'),
    ('sunway'),
    ('tal'),
    ('token - thăng long 3')
)
select
  k.group_key,
  c.id,
  c.code,
  c.short_name,
  c.name,
  case when c.id = max(c.id) over (partition by k.group_key) then 'KEEP' else 'DROP' end as action,
  (select count(*) from trangway.orders o where o.company_id = c.id) as orders_cnt,
  (select count(*) from trangway.workers w where w.current_company_id = c.id) as workers_cnt,
  (select count(*) from trangway.work_sites s where s.company_id = c.id) as sites_cnt
from keys k
join trangway.companies c
  on lower(trim(c.short_name)) = k.group_key
order by k.group_key, c.id;
