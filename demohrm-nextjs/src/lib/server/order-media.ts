import "server-only";

import { getSupabase } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { noteWithoutMedia } from "@/lib/order-card";

export const ORDER_IMAGES_BUCKET = "order-images";

const PUBLIC_MARK = `/storage/v1/object/public/${ORDER_IMAGES_BUCKET}/`;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i;
const MAX_IMAGE_BYTES = 5_000_000;

export function isOrderMediaSetupError(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "42501" ||
    /bucket not found|row-level security/i.test(message)
  );
}

export function publicImageUrl(path: string): string {
  const encoded = path.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${serverEnv.supabaseUrl}${PUBLIC_MARK}${encoded}`;
}

export function storagePathFromUrl(url: string): string | null {
  const index = url.indexOf(PUBLIC_MARK);
  if (index < 0) return null;
  const path = url.slice(index + PUBLIC_MARK.length).split("?")[0] ?? "";
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

type OrderExtra = { id: number; note: string | null; video_url: string | null };

async function loadOrderExtras(ids: number[]): Promise<OrderExtra[]> {
  const withVideo = await getSupabase().from("orders").select("id,note,video_url").in("id", ids);
  if (!withVideo.error) return (withVideo.data ?? []) as OrderExtra[];
  if (withVideo.error.code !== "42703" && withVideo.error.code !== "PGRST204") throw withVideo.error;
  const plain = await getSupabase().from("orders").select("id,note").in("id", ids);
  if (plain.error) throw plain.error;
  return (plain.data ?? []).map((row) => ({
    id: row.id as number,
    note: (row.note as string | null) ?? null,
    video_url: null,
  }));
}

export async function listImageUrls(orderIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (orderIds.length === 0) return map;
  const listed = await getSupabase()
    .from("order_images")
    .select("order_id,storage_path,sort_order")
    .in("order_id", orderIds);
  if (listed.error) {
    if (listed.error.code === "PGRST205") return map;
    throw listed.error;
  }
  const rows = [...(listed.data ?? [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  for (const row of rows) {
    const orderId = row.order_id as number;
    const urls = map.get(orderId) ?? [];
    urls.push(publicImageUrl(String(row.storage_path)));
    map.set(orderId, urls);
  }
  return map;
}

export async function attachOrderMedia<T extends { order_id: number }>(
  rows: T[],
): Promise<Array<T & { card_note: string | null; video_url: string | null; image_urls: string[] }>> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.order_id);
  const [extras, images] = await Promise.all([loadOrderExtras(ids), listImageUrls(ids)]);
  const byId = new Map(extras.map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...row,
    card_note: byId.get(row.order_id)?.note ?? null,
    video_url: byId.get(row.order_id)?.video_url ?? null,
    image_urls: images.get(row.order_id) ?? [],
  }));
}

function decodedImage(dataUrl: string): { mime: string; ext: string; bytes: Buffer } | null {
  const match = DATA_URL.exec(dataUrl.replace(/\s/g, ""));
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, bytes };
}

async function replaceImages(orderId: number, images: string[]): Promise<string[]> {
  const sb = getSupabase();
  const nextPaths: string[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const src = images[index] ?? "";
    const existingPath = storagePathFromUrl(src);
    if (existingPath && existingPath.startsWith(`${orderId}/`)) {
      nextPaths.push(existingPath);
      continue;
    }
    if (!src.startsWith("data:")) continue;
    const image = decodedImage(src);
    if (!image) {
      const invalid = new Error("Ảnh không đúng định dạng hoặc lớn hơn 5MB.") as Error & { status?: number };
      invalid.status = 400;
      throw invalid;
    }
    const path = `${orderId}/${Date.now()}-${index}.${image.ext}`;
    const uploaded = await sb.storage.from(ORDER_IMAGES_BUCKET).upload(path, new Blob([new Uint8Array(image.bytes)], { type: image.mime }), {
      contentType: image.mime,
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    nextPaths.push(path);
  }

  const current = await sb.from("order_images").select("storage_path").eq("order_id", orderId);
  if (current.error) throw current.error;
  const previous = (current.data ?? []).map((row) => String(row.storage_path));
  const keep = new Set(nextPaths);
  const stale = previous.filter((path) => !keep.has(path));
  if (stale.length > 0) {
    const removed = await sb.storage.from(ORDER_IMAGES_BUCKET).remove(stale);
    if (removed.error && !/bucket not found/i.test(removed.error.message)) throw removed.error;
  }
  const cleared = await sb.from("order_images").delete().eq("order_id", orderId);
  if (cleared.error) throw cleared.error;
  if (nextPaths.length > 0) {
    const inserted = await sb.from("order_images").insert(
      nextPaths.map((storagePath, index) => ({ order_id: orderId, storage_path: storagePath, sort_order: index + 1 })),
    );
    if (inserted.error) throw inserted.error;
  }
  return nextPaths.map((path) => publicImageUrl(path));
}

export async function saveOrderMedia(
  orderId: number,
  input: { videoUrl?: string; images?: string[] },
): Promise<{ video_url: string; images: string[] }> {
  const sb = getSupabase();
  const existing = await sb.from("orders").select("id,note").eq("id", orderId).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) {
    const missing = new Error("Không tìm thấy đơn.") as Error & { code?: string };
    missing.code = "PGRST116";
    throw missing;
  }
  if (input.videoUrl !== undefined) {
    const updated = await sb.from("orders").update({ video_url: input.videoUrl }).eq("id", orderId).select("id").single();
    if (updated.error) throw updated.error;
  }
  let videoUrl = input.videoUrl ?? "";
  if (input.videoUrl === undefined) {
    const current = await sb.from("orders").select("video_url").eq("id", orderId).maybeSingle();
    if (current.error) {
      if (current.error.code !== "42703" && current.error.code !== "PGRST204") throw current.error;
    } else {
      videoUrl = String(current.data?.video_url ?? "");
    }
  }
  const images = input.images ? await replaceImages(orderId, input.images) : (await listImageUrls([orderId])).get(orderId) ?? [];
  if (input.images) {
    const stripped = await sb.from("orders").update({ note: noteWithoutMedia(existing.data.note as string | null) }).eq("id", orderId);
    if (stripped.error) throw stripped.error;
  }
  return { video_url: videoUrl, images };
}

export async function removeOrderMedia(orderId: number): Promise<void> {
  const sb = getSupabase();
  const existing = await sb.from("order_images").select("storage_path").eq("order_id", orderId);
  if (existing.error) {
    if (existing.error.code === "PGRST205") return;
    throw existing.error;
  }
  const paths = (existing.data ?? []).map((row) => String(row.storage_path));
  if (paths.length > 0) {
    const removed = await sb.storage.from(ORDER_IMAGES_BUCKET).remove(paths);
    if (removed.error && !/bucket not found/i.test(removed.error.message)) throw removed.error;
  }
  const cleared = await sb.from("order_images").delete().eq("order_id", orderId);
  if (cleared.error && cleared.error.code !== "PGRST205") throw cleared.error;
}
