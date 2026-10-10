import "server-only";

import { json } from "@/lib/server/http";

function bad(message: string): Response {
  return json({ error: "bad_request", message }, 400);
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function companyPayload(src: Record<string, unknown>, creating: boolean): Record<string, unknown> | Response {
  const code = String(src["code"] ?? "").trim();
  const shortName = String(src["short_name"] ?? "").trim();
  const name = String(src["name"] ?? "").trim();
  if (creating && !code) return bad("Nhập mã khách hàng.");
  if ((creating || src["short_name"] !== undefined) && !shortName) return bad("Nhập tên ngắn.");
  if ((creating || src["name"] !== undefined) && !name) return bad("Nhập tên công ty.");
  if (!creating && src["code"] !== undefined && !code) return bad("Nhập mã khách hàng.");

  const out: Record<string, unknown> = {};
  if (creating || src["code"] !== undefined) out["code"] = code;
  if (creating || src["short_name"] !== undefined) out["short_name"] = shortName;
  if (creating || src["name"] !== undefined) out["name"] = name;
  for (const key of ["hotline", "contact_name", "contact_phone", "tax_code"] as const) {
    if (creating || src[key] !== undefined) out[key] = textOrNull(src[key]);
  }
  if (creating || src["bill_rate_per_day"] !== undefined) {
    const raw = src["bill_rate_per_day"];
    if (raw === "" || raw === null || raw === undefined) {
      out["bill_rate_per_day"] = null;
    } else {
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate < 0) return bad("Đơn giá một ngày không hợp lệ.");
      out["bill_rate_per_day"] = rate;
    }
  }
  return out;
}
