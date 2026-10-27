import { fetchLiveWorkerOptions } from "@/lib/live";
import type { LiveWorkerRow } from "@/lib/live";

type CacheKey = string;

const cache = new Map<CacheKey, { at: number; rows: LiveWorkerRow[] }>();
const inflight = new Map<CacheKey, Promise<LiveWorkerRow[]>>();

const TTL_MS = 60_000;

function keyOf(q: string, limit: number, id?: number | null, company?: string | null): CacheKey {
  return `${q.trim().toLowerCase()}|${limit}|${id ?? ""}|${(company ?? "").trim().toLowerCase()}`;
}

/** Options gọn + cache ngắn hạn; gộp request trùng. */
export async function loadWorkerOptions(opts?: {
  q?: string;
  limit?: number;
  id?: number | null;
  company?: string | null;
  force?: boolean;
}): Promise<LiveWorkerRow[]> {
  const q = opts?.q?.trim() ?? "";
  const limit = opts?.limit ?? 40;
  const id = opts?.id ?? null;
  const company = opts?.company?.trim() || null;
  const key = keyOf(q, limit, id, company);
  const hit = cache.get(key);
  if (!opts?.force && hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = fetchLiveWorkerOptions({ q: q || undefined, limit, id, company })
    .then((rows) => {
      cache.set(key, { at: Date.now(), rows });
      inflight.delete(key);
      return rows;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, task);
  return task;
}

export function peekWorkerOptionsCache(q = "", limit = 40, company?: string | null): LiveWorkerRow[] | null {
  const hit = cache.get(keyOf(q, limit, null, company));
  if (!hit) return null;
  if (Date.now() - hit.at >= TTL_MS) return null;
  return hit.rows;
}
