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
    const { data: historyRows, error } = await getSupabase()
      .from("salary_entry_history")
      .select("*")
      .eq("entry_id", Number(p["id"]))
      .order("revision_no");
    if (error) throw error;

    const staffIds = Array.from(
      new Set((historyRows ?? []).map((r) => r.changed_by).filter((id): id is number => typeof id === "number")),
    );
    let staffMap = new Map<number, string>();
    if (staffIds.length > 0) {
      const { data: staffs } = await getSupabase()
        .from("staff")
        .select("id, full_name")
        .in("id", staffIds);
      if (staffs) {
        staffMap = new Map(staffs.map((s) => [s.id, s.full_name]));
      }
    }

    // Fetch current entry to get the latest updated values
    const { data: currentEntry } = await getSupabase()
      .from("salary_entries")
      .select("*")
      .eq("id", Number(p["id"]))
      .maybeSingle();

    const enriched = (historyRows ?? []).map((r, idx) => {
      const oldData = (r.old_data || {}) as Record<string, unknown>;
      const nextRow = historyRows?.[idx + 1];
      const nextData = (nextRow ? (nextRow.old_data as Record<string, unknown>) : currentEntry) as Record<string, unknown> | null;
      return {
        id: r.id,
        entry_id: r.entry_id,
        revision_no: r.revision_no,
        changed_at: r.changed_at,
        changed_by: r.changed_by,
        change_type: "update",
        work_days_old: oldData.work_days ?? null,
        work_days_new: nextData?.work_days ?? null,
        daily_rate_old: oldData.daily_rate ?? null,
        daily_rate_new: nextData?.daily_rate ?? null,
        amount_old: r.old_amount ?? oldData.amount ?? null,
        amount_new: r.new_amount ?? nextData?.amount ?? null,
        content_old: oldData.content ?? null,
        content_new: nextData?.content ?? null,
        reason: r.change_reason ?? null,
        changed_by_staff: r.changed_by
          ? { full_name: staffMap.get(r.changed_by) ?? `NV #${r.changed_by}` }
          : null,
      };
    });

    return json(enriched);
  } catch (e) {
    return apiError(e);
  }
}
