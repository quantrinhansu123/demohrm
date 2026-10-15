-- Bỏ UNIQUE(national_id/CCCD) để cho phép tạo hồ sơ mới khi hồ sơ cũ đã Nghỉ việc.
-- Rule trùng chuyển sang check ở FE (check-duplicates + matched_status)
-- và BE (POST /workers: exists national_id/phone + status != resigned -> 409).
-- Chạy 1 lần trong Supabase SQL editor (schema trangway).
--
-- 1. Xóa mọi UNIQUE constraint / index bao phủ national_id (và citizen_id legacy nếu có).

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop UNIQUE constraints trên workers(national_id)
  FOR r IN
    SELECT con.conname AS cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'trangway'
      AND rel.relname = 'workers'
      AND con.contype = 'u'
      AND con.conkey IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS colnum
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = colnum
        WHERE att.attname IN ('national_id', 'citizen_id')
      )
  LOOP
    EXECUTE format('ALTER TABLE trangway.workers DROP CONSTRAINT %I', r.cname);
  END LOOP;

  -- Drop UNIQUE constraints trên workers(phone) nếu có (SĐT được phép trùng sau nghỉ)
  FOR r IN
    SELECT con.conname AS cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'trangway'
      AND rel.relname = 'workers'
      AND con.contype = 'u'
      AND con.conkey IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS colnum
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = colnum
        WHERE att.attname = 'phone'
      )
  LOOP
    EXECUTE format('ALTER TABLE trangway.workers DROP CONSTRAINT %I', r.cname);
  END LOOP;
END $$;

-- 2. Xóa unique index đơn lẻ trên national_id / citizen_id / phone (nếu constraint dùng index riêng)
DROP INDEX IF EXISTS trangway.workers_national_id_key;
DROP INDEX IF EXISTS trangway.workers_national_id_unique;
DROP INDEX IF EXISTS trangway.workers_citizen_id_key;
DROP INDEX IF EXISTS trangway.workers_phone_key;

-- 3. Chặn trùng ở tầng DB cho hồ sơ chưa nghỉ việc (chống race-condition khi 2 người tạo cùng lúc).
-- Nếu báo lỗi vì dữ liệu cũ đã trùng CCCD ở hồ sơ đang hoạt động, xử lý các hồ sơ đó trước.
CREATE UNIQUE INDEX IF NOT EXISTS workers_national_id_active_unique
  ON trangway.workers (national_id) WHERE status <> 'resigned';
