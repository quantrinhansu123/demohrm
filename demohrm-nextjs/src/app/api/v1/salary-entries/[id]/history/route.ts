export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const { data, error } = await getSupabase()
      .from("salary_entry_history")
      .select("*, changed_by_staff:staff!salary_entry_history_changed_by_fkey(full_name)")
      .eq("entry_id", Number(p["id"]))
      .order("revision_no");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
