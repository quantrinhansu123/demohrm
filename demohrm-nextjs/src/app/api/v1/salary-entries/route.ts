export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

// GET /api/v1/salary-entries?worker=&period= — Tung lan nhap luong
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const q = getSupabase()
      .from("salary_entries")
      .select(
        "id,code,worker_id,placement_id,period_id,entry_type,work_days,daily_rate,amount,content,entry_date,is_auto,revision_no,voided_at,void_reason,created_at,updated_at,workers(code,full_name),staff:entered_by(full_name)",
      )
      .order("id", { ascending: false })
      .limit(500);
    const worker = searchParams(req).get("worker");
    if (worker) q.eq("worker_id", Number(worker));
    const period = searchParams(req).get("period");
    if (period) q.eq("period_id", Number(period));
    const { data, error } = await q;
    if (error) throw error;

    // Enrich with placement info (company, order_code, position)
    const placementIds = Array.from(
      new Set(
        (data ?? [])
          .map((d: Record<string, unknown>) => Number(d["placement_id"]))
          .filter((id: number) => Number.isInteger(id) && id > 0),
      ),
    );

    const assignmentMap = new Map<number, { company: string; order_code: string; position: string }>();
    if (placementIds.length > 0) {
      const { data: assignments } = await getSupabase()
        .from("v_worker_assignments")
        .select("placement_id, company, order_code, position")
        .in("placement_id", placementIds);
      if (assignments) {
        for (const a of assignments) {
          if (a.placement_id && !assignmentMap.has(a.placement_id)) {
            assignmentMap.set(a.placement_id, {
              company: a.company,
              order_code: a.order_code,
              position: a.position,
            });
          }
        }
      }
    }

    const enriched = (data ?? []).map((e: Record<string, unknown>) => {
      const pid = Number(e["placement_id"]);
      const plm = assignmentMap.get(pid);
      return {
        ...e,
        company: plm?.company ?? null,
        order_code: plm?.order_code ?? null,
        position: plm?.position ?? null,
      };
    });

    return json(enriched);
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/v1/salary-entries — Dong nhap moi (bo sung). Sua: UPDATE (trigger luu lich su). Huy: voided_at.
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), [
      "code",
      "worker_id",
      "placement_id",
      "period_id",
      "entry_type",
      "work_days",
      "daily_rate",
      "amount",
      "content",
      "entry_date",
    ]);

    if (!body.worker_id) {
      return json({ error: "missing_worker", message: "Vui lòng chọn người lao động." }, 400);
    }
    const workerId = Number(body.worker_id);

    // 1. Placement ID (bat buoc trong database)
    if (!body.placement_id) {
      const { data: latestPlm } = await getSupabase()
        .from("worker_placements")
        .select("id")
        .eq("worker_id", workerId)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestPlm?.id) {
        return json(
          {
            error: "no_placement",
            message: "Người lao động chưa có đợt làm việc nào. Vui lòng thêm đợt làm việc trước khi nhập dòng lương.",
          },
          400,
        );
      }
      body.placement_id = latestPlm.id;
    } else {
      body.placement_id = Number(body.placement_id);
    }

    // 2. Period ID
    if (!body.period_id) {
      const { data: curPeriod } = await getSupabase()
        .from("periods")
        .select("id, code")
        .eq("type", "month")
        .order("start_date", { ascending: false })
        .limit(1)
        .single();
      if (curPeriod?.id) {
        body.period_id = curPeriod.id;
      } else {
        return json({ error: "missing_period", message: "Không tìm thấy chu kỳ lương hợp lệ." }, 400);
      }
    } else {
      body.period_id = Number(body.period_id);
    }

    // 3. Entry Type mapping:
    // DB enum: 'wage', 'supplement', 'allowance', 'bonus', 'deduction'
    let rawType = String(body.entry_type || "supplement");
    if (rawType === "extra") rawType = "allowance";
    const VALID_TYPES = ["wage", "supplement", "allowance", "bonus", "deduction"];
    if (!VALID_TYPES.includes(rawType)) {
      rawType = "supplement";
    }

    // DB check: entry_type <> 'wage' OR (work_days IS NOT NULL AND daily_rate IS NOT NULL)
    const workDays = body.work_days != null && body.work_days !== "" ? Number(body.work_days) : null;
    const dailyRate = body.daily_rate != null && body.daily_rate !== "" ? Number(body.daily_rate) : null;
    if (rawType === "wage" && (workDays == null || dailyRate == null)) {
      rawType = "supplement";
    }
    body.entry_type = rawType;
    body.work_days = workDays;
    body.daily_rate = dailyRate;

    // 4. Amount
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "invalid_amount", message: "Số tiền phải là số lớn hơn 0." }, 400);
    }
    body.amount = amount;

    // 5. Entry Date
    if (!body.entry_date) {
      body.entry_date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    }

    // 6. Content (NOT NULL trong DB)
    if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
      const typeLabels: Record<string, string> = {
        wage: "Lương theo ngày công",
        supplement: "Lương bổ sung",
        allowance: "Phụ cấp",
        bonus: "Thưởng",
        deduction: "Khấu trừ",
      };
      body.content = typeLabels[rawType] || "Dòng lương";
    } else {
      body.content = (body.content as string).trim();
    }

    // 7. Auto-generate code if missing
    if (!body.code) {
      const { data: periodRow } = await getSupabase()
        .from("periods")
        .select("code")
        .eq("id", body.period_id)
        .single();
      const pCode = periodRow?.code || "CK-2610";
      const shortPeriod = pCode.replace(/^CK-?/i, "").replace(/-/g, "") || "2610";

      const { count } = await getSupabase()
        .from("salary_entries")
        .select("id", { count: "exact", head: true })
        .eq("period_id", body.period_id);

      let seq = Math.max(9001, (count ?? 0) + 9001);
      let candidate = `LG-${shortPeriod}-${String(seq).padStart(4, "0")}`;
      let attempts = 0;
      while (attempts < 10) {
        const { data: exists } = await getSupabase()
          .from("salary_entries")
          .select("id")
          .eq("code", candidate)
          .maybeSingle();
        if (!exists) break;
        seq += 1;
        candidate = `LG-${shortPeriod}-${String(seq).padStart(4, "0")}`;
        attempts += 1;
      }
      body.code = candidate;
    }

    // 8. Staff
    if (auth.staffId) body.entered_by = Number(auth.staffId);

    const { data, error } = await getSupabase()
      .from("salary_entries")
      .insert(body)
      .select("id,code,amount,entry_type,content")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
