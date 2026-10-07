const configured = process.env["NEXT_PUBLIC_API_URL"];
// Mac dinh cung origin (/api/* do Next.js phuc vu) — het CORS, het 2 cong.
// Van co the tro sang BE roi bang NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1.
const API_BASE = configured ?? "/api/v1";
const BE_ROOT = API_BASE.replace(/\/api\/v1$/, "");
const SESSION_KEY = "tw_session";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface ApiOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const token = (JSON.parse(raw) as { token?: string }).token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function errorMessage(status: number, payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const m = (payload as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return `Yêu cầu thất bại (HTTP ${status})`;
}

async function request<T>(path: string, init: RequestInit, opts?: ApiOptions): Promise<T> {
  if (!API_BASE) throw new ApiError(0, "Thiếu NEXT_PUBLIC_API_URL.", null);
  const controller = new AbortController();
  const timer = opts?.signal ? null : setTimeout(() => controller.abort(), opts?.timeoutMs ?? 15000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: opts?.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (res.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
        sessionStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new Event("tw-unauthorized"));
      }
      throw new ApiError(res.status, errorMessage(res.status, payload), payload);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function apiGet<T>(path: string, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { method: "GET" }, opts);
}

export function apiPost<T>(path: string, body: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) }, opts);
}

export function apiPatch<T>(path: string, body: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, opts);
}

export function apiDelete<T>(path: string, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { method: "DELETE" }, opts);
}

export async function checkBeHealth(): Promise<boolean> {
  const url = BE_ROOT ? `${BE_ROOT}/health` : "/api/health";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}
