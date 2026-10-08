export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function prevDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function updatePositionExtra(positionId: number, body: Record<string, unknown>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (typeof body.job_description === "string") {
    updates.job_description = body.job_description.trim() || null;
  }
  if (typeof body.wage_unit === "string") {
    updates.wage_unit = body.wage_unit;
  }
  if (body.shift_id !== undefined) {
    updates.shift_id = body.shift_id ? Number(body.shift_id) : null;
  }
  if (Object.keys(updates).length > 0) {
    await getSupabase().from("order_positions").update(updates).eq("id", positionId);
  }
}

// POST /api/v1/positions/:id/wage-rates — Thêm hoặc cập nhật mức lương vị trí
export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    const p = await ctx.params;
    const positionId = positiveInt(p["id"]);
    if (!positionId) {
      return json({ error: "invalid", message: "Id vị trí không hợp lệ." }, 400);
    }

    const { data: pos, error: posErr } = await getSupabase()
      .from("order_positions")
      .select("id, title, order_id, job_description, wage_unit, shift_id")
      .eq("id", positionId)
      .maybeSingle();
    if (posErr) throw posErr;
    if (!pos) {
      return json({ error: "not_found", message: "Không tìm thấy vị trí tuyển dụng." }, 404);
    }

    const body = await readBody(req);

    const effectiveFrom = typeof body.effective_from === "string" ? body.effective_from.trim() : "";
    if (!effectiveFrom) {
      return json({ error: "invalid", message: "Vui lòng nhập ngày bắt đầu hiệu lực." }, 400);
    }

    const effectiveTo = typeof body.effective_to === "string" && body.effective_to.trim() ? body.effective_to.trim() : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      return json({ error: "invalid", message: "Ngày kết thúc không được trước ngày bắt đầu hiệu lực." }, 400);
    }

    const validUnits = ["day", "hour", "month", "shift", "product"];
    const wageUnit = typeof body.wage_unit === "string" && validUnits.includes(body.wage_unit) ? body.wage_unit : "day";
    const numRate = Number(body.rate_amount);
    const numDayRate = Number(body.day_rate);
    let rateAmount = Number.isFinite(numRate) && numRate > 0 ? numRate : 0;
    let dayRate = Number.isFinite(numDayRate) && numDayRate > 0 ? numDayRate : 0;

    if (rateAmount <= 0 && dayRate <= 0) {
      return json({ error: "invalid", message: "Vui lòng nhập đơn giá hoặc mức lương lớn hơn 0." }, 400);
    }
    if (rateAmount <= 0) rateAmount = dayRate;
    if (dayRate <= 0) {
      if (wageUnit === "hour") dayRate = rateAmount * 8;
      else if (wageUnit === "month") dayRate = Math.round(rateAmount / 26);
      else dayRate = rateAmount;
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    // Check existing open rates for this position
    const { data: openRates, error: e0 } = await getSupabase()
      .from("position_wage_rates")
      .select("id, effective_from, effective_to")
      .eq("position_id", positionId)
      .is("effective_to", null);
    if (e0) throw e0;

    // If an open rate already starts on the exact same effective_from date, update it directly
    const sameDayRate = (openRates ?? []).find((r) => r.effective_from === effectiveFrom);
    if (sameDayRate) {
      const { data: updated, error: upErr } = await getSupabase()
        .from("position_wage_rates")
        .update({
          wage_unit: wageUnit,
          rate_amount: rateAmount,
          day_rate: dayRate,
          effective_to: effectiveTo,
          note: note,
        })
        .eq("id", sameDayRate.id)
        .select("id, position_id, effective_from, effective_to, rate_amount, day_rate, wage_unit, note")
        .single();
      if (upErr) throw upErr;

      await updatePositionExtra(positionId, body);
      return json(updated, 200);
    }

    // If any open rate has effective_from > effectiveFrom, that means new rate is earlier than an existing open rate
    const futureOpenRate = (openRates ?? []).find((r) => r.effective_from > effectiveFrom);
    if (futureOpenRate) {
      return json(
        {
          error: "invalid",
          message: `Ngày hiệu lực (${effectiveFrom}) phải sau ngày bắt đầu của mức lương hiện tại (${futureOpenRate.effective_from}).`,
        },
        400,
      );
    }

    // Close older open rates with effective_to = (effectiveFrom - 1 day) so ranges never overlap
    const prevDay = prevDateStr(effectiveFrom);
    const openIds = (openRates ?? []).map((r) => r.id);
    if (openIds.length > 0) {
      const { error: closeErr } = await getSupabase()
        .from("position_wage_rates")
        .update({ effective_to: prevDay })
        .in("id", openIds);
      if (closeErr) throw closeErr;
    }

    const { data: created, error: e2 } = await getSupabase()
      .from("position_wage_rates")
      .insert({
        position_id: positionId,
        wage_unit: wageUnit,
        rate_amount: rateAmount,
        day_rate: dayRate,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        note: note,
        created_by: auth.staffId ? Number(auth.staffId) : null,
      })
      .select("id, position_id, effective_from, effective_to, rate_amount, day_rate, wage_unit, note")
      .single();

    if (e2) {
      if (openIds.length > 0) {
        await getSupabase().from("position_wage_rates").update({ effective_to: null }).in("id", openIds);
      }
      throw e2;
    }

    await updatePositionExtra(positionId, body);

    return json(created, 201);
  } catch (e) {
    return apiError(e);
  }
}
