export const runtime = "nodejs";

import { getAuth, writeAudit } from "@/lib/server/authctx";
import { serverEnv } from "@/lib/server/env";
import { apiError, json, readBody } from "@/lib/server/http";
import { TokenError, signHandover } from "@/lib/server/token";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// POST /api/v1/handovers/:id/invite — Dieu phoi tao link xac nhan cho quan ly (rule 13)
export async function POST(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    const auth = getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const body = await readBody(req);
    const ttl = Number(body["ttl_hours"] ?? 72);
    const token = signHandover(id, ttl);
    await writeAudit(auth, {
      action: "EXPORT",
      table: "handovers",
      recordId: id,
      detail: `Tạo link xác nhận bàn giao (hết hạn sau ${ttl}h)`,
    });
    return json({ url: `${serverEnv.publicAppUrl}/ban-giao/${token}`, expires_hours: ttl });
  } catch (e) {    if (e instanceof TokenError) {
      return json({ error: "bad_token", message: e.message }, 400);
    }
    return apiError(e);
  }
}
