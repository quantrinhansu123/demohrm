export const runtime = "nodejs";

import { writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, clientIp, json, readBody } from "@/lib/server/http";
import { verifyPin } from "@/lib/server/pin";
import { signSession } from "@/lib/server/token";

// POST /api/v1/auth/login — Dang nhap bang ma nhan vien + PIN (public)
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await readBody(req);
    const code = typeof body["code"] === "string" ? body["code"] : "";
    const pin = typeof body["pin"] === "string" ? body["pin"] : "";
    if (!code.trim() || !pin) {
      return json({ error: "bad_request", message: "Thieu ma nhan vien hoac PIN." }, 400);
    }
    const { data: staff, error } = await getSupabase()
      .from("staff")
      .select("id,code,full_name,role,title,status,pin_hash")
      .ilike("code", code.trim())
      .maybeSingle();
    if (error) throw error;
    const s = staff as { id: number; code: string; full_name: string; role: string; title: string; status: string; pin_hash: string | null } | null;
    if (!s || s.status !== "active" || !s.pin_hash || !verifyPin(pin, s.pin_hash)) {
      return json({ error: "invalid_credentials", message: "Sai mã nhân viên hoặc PIN." }, 401);
    }
    const token = signSession(s.id, s.role);
    await writeAudit(
      { staffId: String(s.id), staffRole: s.role, ip: clientIp(req) },
      {
        action: "LOGIN",
        table: "staff",
        recordId: s.id,
        detail: `${s.full_name} (${s.code}) dang nhap`,
      }
    );
    return json({ token, staff: { id: s.id, code: s.code, full_name: s.full_name, role: s.role, title: s.title } });
  } catch (e) {
    return apiError(e);
  }
}
