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
  if (err.code === "23502") {
    const column = /column "([^"]+)"/.exec(err.message ?? "")?.[1];
    return Response.json(
      { error: "not_null", message: column ? `Thiếu dữ liệu bắt buộc: ${column}.` : "Thiếu dữ liệu bắt buộc." },
      { status: 400 },
    );
  }
  if (err.code === "23514") return Response.json({ error: "check_violation", message: "Dữ liệu không thỏa điều kiện." }, { status: 400 });
  if (err.code === "22P02") return Response.json({ error: "invalid", message: "Giá trị không nằm trong danh mục cho phép." }, { status: 400 });
  if (err.code === "22003") return Response.json({ error: "numeric_overflow", message: "Dữ liệu số vượt giới hạn (tọa độ địa điểm hoặc khoảng cách chấm công). Kiểm tra tọa độ địa điểm làm việc." }, { status: 400 });
  if (err.code === "23P01") return Response.json({ error: "overlap", message: "Hai đợt làm việc chồng thời gian." }, { status: 409 });
  if (err.code === "23503") return Response.json({ error: "foreign_key", message: "Tham chiếu không tồn tại hoặc hồ sơ đang được dùng." }, { status: 400 });
  if (err.code === "PGRST116") return Response.json({ error: "not_found", message: "Không tìm thấy." }, { status: 404 });
  if (err.code === "PGRST205") {
    const table = /'([^']+)'/.exec(err.message ?? "")?.[1];
    return Response.json(
      {
        error: "missing_table",
        message: `Chưa chạy migration CSDL${table ? ` cho bảng ${table}` : ""}. Hãy chạy migration tương ứng trong thư mục supabase/.`,
      },
      { status: 400 },
    );
  }
  if (err.code === "PGRST204" || err.code === "42703") {
    const column =
      /'([^']+)' column/.exec(err.message ?? "")?.[1] ??
      /column ([^\s]+) does not exist/.exec(err.message ?? "")?.[1];
    return Response.json(
      {
        error: "missing_column",
        message: `CSDL thiếu cột${column ? ` ${column}` : ""}. Hãy chạy lại migration trong thư mục supabase/.`,
      },
      { status: 400 },
    );
  }
  if (err.code === "42P01") {
    return Response.json(
      { error: "missing_table", message: "CSDL thiếu bảng. Hãy chạy migration trong thư mục supabase/." },
      { status: 400 },
    );
  }
  if (err.code === "42501") {
    return Response.json(
      { error: "permission", message: "Không có quyền ghi dữ liệu (RLS/GRANT). Hãy chạy lại migration trong thư mục supabase/." },
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
