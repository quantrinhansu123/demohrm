-- Ngày tư vấn / ngày vào làm / ngày nghỉ việc của người lao động.
-- Chạy một lần trong Supabase SQL editor trước khi dùng tính năng.
alter table trangway.workers
  add column if not exists consult_date date,
  add column if not exists start_work_date date,
  add column if not exists resign_date date;
