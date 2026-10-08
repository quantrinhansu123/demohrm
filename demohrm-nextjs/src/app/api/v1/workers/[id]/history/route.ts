export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /api/v1/workers/:id/history — Lich su sua ho so NLD (ai sua, luc nao)
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }

    const { data: logs, error } = await getSupabase()
      .from("audit_logs")
      .select("id,occurred_at,actor_id,action,detail")
      .eq("table_name", "workers")
      .eq("record_id", String(id))
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const actorIds = Array.from(
      new Set(
        (logs ?? [])
          .map((l) => (l as { actor_id: number | null }).actor_id)
          .filter((aid): aid is number => aid !== null && aid !== undefined),
      ),
    );

    let staffMap = new Map<number, string>();
    if (actorIds.length > 0) {
      const { data: staffList } = await getSupabase()
        .from("staff")
        .select("id,full_name")
        .in("id", actorIds);
      staffMap = new Map((staffList ?? []).map((s) => [s.id as number, s.full_name as string]));
    }

    const result = (logs ?? []).map((l) => {
      const actorId = (l as { actor_id: number | null }).actor_id;
      return {
        id: (l as { id: number }).id,
        occurred_at: (l as { occurred_at: string }).occurred_at,
        actor_name: actorId ? staffMap.get(actorId) ?? `#${actorId}` : "Hệ thống",
        action: (l as { action: string }).action,
        detail: (l as { detail: string | null }).detail,
      };
    });

    return json(result);
  } catch (e) {
    return apiError(e);
  }
}
