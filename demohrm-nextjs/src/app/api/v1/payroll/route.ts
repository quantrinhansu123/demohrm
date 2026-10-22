export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

interface PayrollRow {
  period_code: string;
  worker_id: number | null;
  code: string;
  full_name: string;
  companies?: string | null;
  work_days: number | string;
  wage_amount: number | string;
  extra_amount: number | string;
  deduction: number | string;
  advance_amount: number | string;
  net_amount: number | string;
  has_variance: boolean;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const period = sp.get("period");
    const worker = sp.get("worker");

    let payrollQuery = getSupabase()
      .from("v_payroll_preview")
      .select(
        "period_code,worker_id,code,full_name,companies,work_days,wage_amount,extra_amount,deduction,advance_amount,net_amount,has_variance",
      )
      .limit(500);
    if (period) payrollQuery = payrollQuery.eq("period_code", period);
    if (worker) payrollQuery = payrollQuery.eq("code", worker);

    const payrollRes = await payrollQuery;
    if (payrollRes.error) throw payrollRes.error;

    const rows = (payrollRes.data ?? []) as unknown as PayrollRow[];
    if (!period || rows.length === 0) return json(rows);

    const periodRes = await getSupabase()
      .from("periods")
      .select("start_date,end_date")
      .eq("code", period)
      .maybeSingle();
    if (periodRes.error) throw periodRes.error;
    if (!periodRes.data) return json(rows);

    const advancesRes = await getSupabase()
      .from("advances")
      .select("worker_id,amount")
      .eq("subject_type", "worker")
      .in("status", ["approved", "paid", "settled"])
      .gte("advance_date", periodRes.data.start_date)
      .lte("advance_date", periodRes.data.end_date);
    if (advancesRes.error) throw advancesRes.error;

    const advanceByWorker = new Map<number, number>();
    for (const advance of advancesRes.data ?? []) {
      const workerId = Number(advance.worker_id);
      if (!Number.isInteger(workerId) || workerId <= 0) continue;
      advanceByWorker.set(workerId, (advanceByWorker.get(workerId) ?? 0) + num(advance.amount));
    }

    return json(
      rows.map((row) => {
        const advanceAmount = row.worker_id ? advanceByWorker.get(row.worker_id) ?? 0 : 0;
        const netAmount = num(row.wage_amount) + num(row.extra_amount) - num(row.deduction) - advanceAmount;
        return {
          ...row,
          advance_amount: advanceAmount,
          net_amount: netAmount,
        };
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}
