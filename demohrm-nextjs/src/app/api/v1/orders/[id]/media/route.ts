export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { apiError, json, readBody } from "@/lib/server/http";
import { isOrderMediaSetupError, saveOrderMedia } from "@/lib/server/order-media";

function orderIdOf(params: Record<string, string>): number | null {
  const id = Number(params["id"]);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function videoUrlOf(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.length > 500) {
    throw Object.assign(new Error("Link video quá dài."), { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error("Link video phải bắt đầu bằng http hoặc https."), { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Object.assign(new Error("Link video phải bắt đầu bằng http hoặc https."), { status: 400 });
  }
  return url.toString();
}

// POST /api/v1/orders/:id/media — Lưu link video trên đơn, ảnh vào bucket order-images
export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const id = orderIdOf(await ctx.params);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = await readBody(req);
    const videoUrl = videoUrlOf(body["video_url"]);
    const images = body["images"];
    if (images !== undefined && !Array.isArray(images)) {
      return json({ error: "invalid", message: "Danh sách ảnh không hợp lệ." }, 400);
    }
    const files = images === undefined ? undefined : images.filter((item): item is string => typeof item === "string");
    if (files && files.length > 12) {
      return json({ error: "invalid", message: "Chỉ lưu tối đa 12 ảnh." }, 400);
    }
    const saved = await saveOrderMedia(id, { videoUrl, images: files });
    return json(saved);
  } catch (e) {
    const err = e as { code?: string; message?: string; status?: number };
    if (err.status === 400) return json({ error: "invalid", message: err.message }, 400);
    if (isOrderMediaSetupError(err)) {
      return json(
        { error: "setup", message: "Supabase chưa có cột video_url và bucket ảnh order-images. Chạy file supabase/order-media.sql trong SQL Editor." },
        400,
      );
    }
    return apiError(e);
  }
}
