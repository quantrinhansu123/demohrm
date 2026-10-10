export const runtime = "nodejs";

import { departmentSpec } from "@/lib/departments";
import { initialsOf } from "@/lib/format";
import { getAuth, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const DIRECTORY_COLUMNS = "id,code,full_name,initials,email,phone,role,title,status";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// PATCH /api/v1/staff/:id — Sua ho so nhan su tren bang staff.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = await readBody(req);
    const fullName = cleanText(body["full_name"], 80);
    if (!fullName) return json({ error: "bad_request", message: "Nhập họ tên." }, 400);
    const department = typeof body["department"] === "string" ? body["department"].trim() : "";
    const spec = departmentSpec(department);
    if (!spec) return json({ error: "bad_request", message: "Chọn phòng ban." }, 400);
    const status = body["status"] === "inactive" ? "inactive" : "active";
    const email = cleanText(body["email"], 120);
    if (email && !email.includes("@")) return json({ error: "bad_request", message: "Email không hợp lệ." }, 400);
    const { data, error } = await getSupabase()
      .from("staff")
      .update({
        full_name: fullName,
        initials: initialsOf(fullName),
        phone: cleanText(body["phone"], 30) || null,
        email: email || null,
        title: spec.label,
        role: spec.role,
        status,
      })
      .eq("id", id)
      .select(DIRECTORY_COLUMNS)
      .single();
    if (error) throw error;
    await writeAudit(auth, {
      action: "UPDATE",
      table: "staff",
      recordId: id,
      detail: `Sua nhan su ${fullName} · ${spec.label}`,
    });
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

// DELETE /api/v1/staff/:id — Xoa nhan su khoi bang staff.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    if (String(id) === auth.staffId) {
      return json({ error: "bad_request", message: "Không xóa tài khoản đang đăng nhập." }, 400);
    }
    const { error } = await getSupabase().from("staff").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return json({ error: "foreign_key", message: "Nhân sự này đang được gắn với nhóm hoặc đơn hàng, chưa xóa được." }, 400);
      }
      throw error;
    }
    await writeAudit(auth, {
      action: "DELETE",
      table: "staff",
      recordId: id,
      detail: `Xoa nhan su #${id}`,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
