export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/auth/me — Ho so nguoi dang dang nhap
export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const { data, error } = await getSupabase()
      .from("staff")
      .select("id,code,full_name,role,title,status")
      .eq("id", Number(auth.staffId))
      .single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
