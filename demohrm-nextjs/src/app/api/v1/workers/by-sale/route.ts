export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

const PAGE = 1000;

// GET /api/v1/workers/by-sale — So NLD theo sale va trang thai nhan su
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const people: { status: string; recruiter_name: string | null }[] = [];
    for (let offset = 0; offset < 20000; offset += PAGE) {
      const { data, error } = await getSupabase()
        .from("v_workers_public")
        .select("status,recruiter_name")
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as { status: string; recruiter_name: string | null }[];
      people.push(...batch);
      if (batch.length < PAGE) break;
    }

    const bySale = new Map<string, Record<string, number>>();
    for (const person of people) {
      const sale = person.recruiter_name?.trim() || "Chưa gán sale";
      const counts = bySale.get(sale) ?? {};
      const status = person.status || "working";
      counts[status] = (counts[status] ?? 0) + 1;
      bySale.set(sale, counts);
    }

    const sales = [...bySale.entries()]
      .map(([sale, counts]) => ({
        sale,
        counts,
        total: Object.values(counts).reduce((sum, qty) => sum + qty, 0),
      }))
      .sort((a, b) => (b.counts["working"] ?? 0) - (a.counts["working"] ?? 0) || b.total - a.total || a.sale.localeCompare(b.sale, "vi"));

    return json({ sales });
  } catch (e) {
    return apiError(e);
  }
}
