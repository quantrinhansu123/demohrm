export const runtime = "nodejs";

import { departmentSpec } from "@/lib/departments";
import { initialsOf } from "@/lib/format";
import { getAuth, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const DIRECTORY_COLUMNS = "id,code,full_name,initials,email,phone,role,title,status";
const CATALOG_COLUMNS = "id,code,full_name,role,title,status";

// GET /api/v1/staff — Danh muc nhan su dang hoat dong.
// GET /api/v1/staff?directory=1 — Bang Nhan su, lay tu bang staff (tai khoan nguoi dung).
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const directory = new URL(req.url).searchParams.get("directory") === "1";
    if (!directory) {
      const { data, error } = await getSupabase()
        .from("staff")
        .select(CATALOG_COLUMNS)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return json(data);
    }
    const full = await getSupabase()
      .from("staff")
      .select("id,code,full_name,initials,email,phone,role,title,status,date_of_birth,hired_on")
      .order("full_name");
    if (full.error?.code === "42703") {
      const again = await getSupabase().from("staff").select(DIRECTORY_COLUMNS).order("full_name");
      if (again.error) throw again.error;
      return json((again.data ?? []).map((row) => ({ ...row, date_of_birth: null, hired_on: null })));
    }
    if (full.error) throw full.error;
    return json(full.data);
  } catch (e) {
    return apiError(e);
  }
}

function dateOrNull(value: unknown): string | null | "invalid" {
  if (typeof value !== "string" || !value.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "invalid";
}

function nextStaffNumber(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const n = Number(/^NV-(\d+)$/.exec(code)?.[1] ?? 0);
    if (n > max) max = n;
  }
  return max;
}

// POST /api/v1/staff — Them mot nhan su.
export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = getAuth(req);
    const body = await readBody(req);
    const department = typeof body["department"] === "string" ? body["department"].trim() : "";
    const spec = departmentSpec(department);
    if (!spec) return json({ error: "bad_request", message: "Chọn phòng ban." }, 400);
    const fullName = typeof body["full_name"] === "string" ? body["full_name"].trim().replace(/\s+/g, " ") : "";
    if (!fullName) return json({ error: "bad_request", message: "Nhập họ tên." }, 400);
    if (fullName.length > 80) return json({ error: "bad_request", message: "Họ tên tối đa 80 ký tự." }, 400);
    const phone = typeof body["phone"] === "string" ? body["phone"].trim() : "";
    const email = typeof body["email"] === "string" ? body["email"].trim() : "";
    const dateOfBirth = dateOrNull(body["date_of_birth"]);
    const hiredOn = dateOrNull(body["hired_on"]);
    if (dateOfBirth === "invalid" || hiredOn === "invalid") {
      return json({ error: "bad_request", message: "Ngày sinh hoặc ngày vào làm không hợp lệ." }, 400);
    }
    const { data: existing, error: listError } = await getSupabase().from("staff").select("code");
    if (listError) throw listError;
    const seq = nextStaffNumber(((existing ?? []) as Array<{ code: string }>).map((row) => row.code)) + 1;
    const row = {
      code: `NV-${String(seq).padStart(3, "0")}`,
      full_name: fullName,
      initials: initialsOf(fullName),
      phone: phone || null,
      email: email || null,
      date_of_birth: dateOfBirth,
      hired_on: hiredOn,
      role: spec.role,
      title: spec.label,
      status: "active",
    };
    const { data, error } = await getSupabase()
      .from("staff")
      .insert(row)
      .select("id,code,full_name,initials,email,phone,role,title,status,date_of_birth,hired_on")
      .single();
    if (error) {
      if (error.code === "42703") {
        return json({ error: "missing_column", message: "Bảng staff chưa có cột ngày sinh và ngày vào làm." }, 400);
      }
      throw error;
    }
    const created = data as { id: number };
    await writeAudit(ctx, {
      action: "INSERT",
      table: "staff",
      recordId: created.id,
      detail: `Them nhan su ${fullName}`,
    });
    return json([data], 201);
  } catch (e) {
    return apiError(e);
  }
}
