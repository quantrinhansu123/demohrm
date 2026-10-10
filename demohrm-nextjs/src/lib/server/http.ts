import "server-only";

// Map loi Postgres/PostgREST -> HTTP, giu nguyen hanh vi BE Express (pgError).
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function apiError(e: unknown): Response {
  const err = e as { code?: string; message?: string };
  if (err instanceof AuthError) return Response.json({ error: "unauthorized", message: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return Response.json({ error: "forbidden", message: err.message }, { status: 403 });
  if (err.code === "23505") return Response.json({ error: "duplicate", message: "Dữ liệu bị trùng." }, { status: 409 });
  if (err.code === "23514") return Response.json({ error: "check_violation", message: "Dữ liệu không thỏa điều kiện." }, { status: 400 });
  if (err.code === "22P02") return Response.json({ error: "invalid", message: "Giá trị không nằm trong danh mục cho phép." }, { status: 400 });
  if (err.code === "23P01") return Response.json({ error: "overlap", message: "Hai đợt làm việc chồng thời gian." }, { status: 409 });
  if (err.code === "23503") return Response.json({ error: "foreign_key", message: "Tham chiếu không tồn tại hoặc hồ sơ đang được dùng." }, { status: 400 });
  if (err.code === "PGRST116") return Response.json({ error: "not_found", message: "Không tìm thấy." }, { status: 404 });
  if (err.code === "42501") {
    return Response.json(
      { error: "internal", message: "Không có quyền truy cập schema trangway trên Supabase." },
      { status: 500 },
    );
  }
  console.error("api error", err.code ?? "", err.message ?? e);
  return Response.json({ error: "internal", message: "Lỗi máy chủ." }, { status: 500 });
}

export class AuthError extends Error {
  constructor(message = "Đăng nhập để tiếp tục.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Vai trò hiện tại không có quyền.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = (await req.json()) as unknown;
    return typeof b === "object" && b !== null ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function searchParams(req: Request): URLSearchParams {
  return new URL(req.url).searchParams;
}
