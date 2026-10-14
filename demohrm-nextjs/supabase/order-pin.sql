-- Ghim đơn hàng lên đầu danh sách (dùng chung cho mọi người).
-- Chạy trong Supabase SQL Editor, rồi tải lại trang đơn hàng.
alter table trangway.orders add column if not exists pinned_at timestamptz;
