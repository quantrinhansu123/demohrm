import "server-only";

import { json } from "@/lib/server/http";

function bad(message: string): Response {
  return json({ error: "bad_request", message }, 400);
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function vendorPayload(src: Record<string, unknown>, creating: boolean): Record<string, unknown> | Response {
  const code = String(src["code"] ?? "").trim();
  const name = String(src["name"] ?? "").trim();
  if (creating && !code) return bad("Nhập mã vendor.");
  if ((creating || src["name"] !== undefined) && !name) return bad("Nhập tên vendor.");
  if (!creating && src["code"] !== undefined && !code) return bad("Nhập mã vendor.");
  if ((creating || src["type"] !== undefined) && !String(src["type"] ?? "").trim()) return bad("Chọn loại vendor.");

  const out: Record<string, unknown> = {};
  if (creating || src["code"] !== undefined) out["code"] = code;
  if (creating || src["name"] !== undefined) out["name"] = name;
  for (const key of ["short_name", "type", "representative", "phone"] as const) {
    if (creating || src[key] !== undefined) out[key] = textOrNull(src[key]);
  }
  if (creating || src["contract_active"] !== undefined) {
    out["contract_active"] = src["contract_active"] === true || src["contract_active"] === "true";
  }
  if (creating || src["fee_per_worker_day"] !== undefined) {
    const raw = src["fee_per_worker_day"];
    if (raw === "" || raw === null || raw === undefined) {
      out["fee_per_worker_day"] = null;
    } else {
      const fee = Number(raw);
      if (!Number.isFinite(fee) || fee < 0) return bad("Phí mỗi ngày không hợp lệ.");
      out["fee_per_worker_day"] = fee;
    }
  }
  if (creating || src["status"] !== undefined) {
    const status = String(src["status"] ?? "good").trim().slice(0, 40);
    out["status"] = status || "good";
  }
  return out;
}
