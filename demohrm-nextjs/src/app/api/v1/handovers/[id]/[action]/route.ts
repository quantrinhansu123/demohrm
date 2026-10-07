export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

async function setHandover(id: number, patch: Record<string, unknown>): Promise<Response> {
  const { data, error } = await getSupabase().from("handovers").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return json(data);
}

// PATCH /api/v1/handovers/:id/hand-over — Dieu phoi ban giao
// PATCH /api/v1/handovers/:id/receive — Quan ly xac nhan tiep nhan
// PATCH /api/v1/handovers/:id/refuse — Quan ly tu choi
export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = Number(p["id"]);
    const action = p["action"] ?? "";
    if (action !== "hand-over" && action !== "receive" && action !== "refuse") {
      return json({ error: "invalid", message: "Hành động không hợp lệ." }, 400);
    }
    const extra = pick(await readBody(req), ["received_by_name", "refuse_reason", "note", "supervisor_id"]);
    if (action === "hand-over") {
      return await setHandover(id, { status: "handed_over", handed_over_at: new Date().toISOString(), ...extra });
    }
    if (action === "receive") {
      return await setHandover(id, { status: "received", received_at: new Date().toISOString(), ...extra });
    }
    return await setHandover(id, { status: "refused", ...extra });
  } catch (e) {
    return apiError(e);
  }
}
