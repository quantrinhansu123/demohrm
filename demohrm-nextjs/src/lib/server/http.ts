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
  if (err.code === "23514") {
    const raw = String(err.message || "").toLowerCase();
    if (raw.includes("national_id") || raw.includes("0-9]{12}")) {
      return Response.json(
        { error: "check_violation", field: "citizenId", message: "Số CCCD không đúng định dạng (phải gồm đúng 12 chữ số)." },
        { status: 400 },
      );
    }
    if (raw.includes("phone")) {
      return Response.json(
        { error: "check_violation", field: "phone", message: "Số điện thoại không đúng định dạng." },
        { status: 400 },
      );
    }
    if (raw.includes("recruiter_id") || raw.includes("source_vendor_id")) {
      return Response.json(
        { error: "check_violation", field: "recruiter", message: "Hồ sơ bắt buộc phải có người tuyển dụng hoặc vendor." },
        { status: 400 },
      );
    }
    if (raw.includes("end_after_start") || raw.includes("end_date")) {
      return Response.json(
        { error: "check_violation", field: "endDate", message: "Ngày kết thúc không được trước ngày vào." },
        { status: 400 },
      );
    }
    if (raw.includes("rate_amount") || raw.includes("day_rate")) {
      return Response.json(
        { error: "check_violation", field: "rate", message: "Đơn giá và mức lương phải lớn hơn 0." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "check_violation", message: "Dữ liệu không thỏa điều kiện kiểm tra (vui lòng kiểm tra lại CCCD, SĐT hoặc ngày tháng)." },
      { status: 400 },
    );
  }
  if (err.code === "23502") return Response.json({ error: "not_null_violation", message: "Vui lòng điền đầy đủ các thông tin bắt buộc." }, { status: 400 });
  if (err.code === "22P02") return Response.json({ error: "invalid_value", message: "Giá trị không hợp lệ." }, { status: 400 });
  if (err.code === "23P01") {
    const raw = String(err.message || "").toLowerCase();
    if (raw.includes("excl_wage_rate_overlap") || raw.includes("position_wage_rates") || raw.includes("rate")) {
      return Response.json({ error: "overlap", message: "Thời gian áp dụng đơn giá bị chồng lấn với đợt áp dụng khác của vị trí này." }, { status: 409 });
    }
    return Response.json({ error: "overlap", message: "Hai đợt làm việc chồng thời gian." }, { status: 409 });
  }
  if (err.code === "23503") return Response.json({ error: "foreign_key", message: "Tham chiếu không tồn tại hoặc hồ sơ đang được dùng." }, { status: 400 });
  if (err.code === "PGRST116") return Response.json({ error: "not_found", message: "Không tìm thấy." }, { status: 404 });
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
