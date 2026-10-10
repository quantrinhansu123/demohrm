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
    let query = getSupabase()
      .from("staff")
      .select(directory ? DIRECTORY_COLUMNS : CATALOG_COLUMNS)
      .order("full_name");
    if (!directory) query = query.eq("status", "active");
    const { data, error } = await query;
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
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
    const { data: existing, error: listError } = await getSupabase().from("staff").select("code");
    if (listError) throw listError;
    const seq = nextStaffNumber(((existing ?? []) as Array<{ code: string }>).map((row) => row.code)) + 1;
    const row = {
      code: `NV-${String(seq).padStart(3, "0")}`,
      full_name: fullName,
      initials: initialsOf(fullName),
      phone: phone || null,
      email: email || null,
      role: spec.role,
      title: spec.label,
      status: "active",
    };
    const { data, error } = await getSupabase().from("staff").insert(row).select(DIRECTORY_COLUMNS).single();
    if (error) throw error;
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
