export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { hashPin, verifyPin } from "@/lib/server/pin";

// POST /api/v1/auth/change-pin — Doi PIN (can PIN cu)
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const sid = Number(auth.staffId);
    const body = await readBody(req);
    const oldPin = typeof body["old_pin"] === "string" ? body["old_pin"] : "";
    const newPin = typeof body["new_pin"] === "string" ? body["new_pin"] : "";
    if (!oldPin || !newPin || newPin.length < 4) {
      return json({ error: "bad_request", message: "PIN moi toi thieu 4 ky tu." }, 400);
    }
    const { data: staff, error: e0 } = await getSupabase().from("staff").select("id,pin_hash").eq("id", sid).single();
    if (e0) throw e0;
    const s = staff as { id: number; pin_hash: string | null };
    if (!s.pin_hash || !verifyPin(oldPin, s.pin_hash)) {
      return json({ error: "invalid_credentials", message: "PIN cu khong dung." }, 401);
    }
    const { error: e1 } = await getSupabase().from("staff").update({ pin_hash: hashPin(newPin) }).eq("id", sid);
    if (e1) throw e1;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
