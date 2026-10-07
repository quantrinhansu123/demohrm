import "server-only";

import { getSupabase } from "@/lib/server/db";
import { AuthError, ForbiddenError, clientIp } from "@/lib/server/http";
import { hasRole } from "@/lib/server/roles";
import { verifySession } from "@/lib/server/token";

export interface AuthContext {
  staffId: string;
  staffRole: string;
  ip: string;
}

// Tuong duong requireAuth cua BE: doc Bearer, verify, tra staffId/role.
// Public route (login, handover by-token) KHONG goi ham nay.
export function getAuth(req: Request): AuthContext {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match?.[1]) throw new AuthError();
  try {
    const session = verifySession(match[1]);
    return { staffId: String(session.sid), staffRole: session.role, ip: clientIp(req) };
  } catch {
    throw new AuthError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
  }
}

export function requireRole(ctx: AuthContext, ...allowed: string[]): void {
  if (!hasRole(ctx.staffRole, allowed)) {
    throw new ForbiddenError();
  }
}

export async function writeAudit(
  ctx: Pick<AuthContext, "ip"> & { staffId?: string; staffRole?: string },
  row: { action: string; table: string; recordId: number | string; detail: string }
): Promise<void> {
  const { error } = await getSupabase().from("audit_logs").insert({
    actor_id: ctx.staffId ? Number(ctx.staffId) : null,
    actor_role: ctx.staffRole || null,
    action: row.action,
    table_name: row.table,
    record_id: String(row.recordId),
    detail: row.detail,
    ip_address: ctx.ip,
  });
  if (error) console.error("audit_logs insert failed", error.code);
}
