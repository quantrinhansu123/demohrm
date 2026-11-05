export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";
import { BLACKLIST_STATUS } from "@/lib/server/roles";

// GET /api/v1/workers/check-blacklist?national_id= — ai cũng gọi được khi tạo hồ sơ.
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const nationalId = (searchParams(req).get("national_id") ?? "").replace(/\D/g, "");
    if (!/^\d{9,12}$/.test(nationalId)) return json(null);

    const { data, error } = await getSupabase()
      .from("workers")
      .select("id,code,full_name,status,national_id")
      .eq("status", BLACKLIST_STATUS)
      .eq("national_id", nationalId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json(null);
    return json({
      id: data.id as number,
      code: String(data.code),
      full_name: String(data.full_name),
      status: String(data.status),
    });
  } catch (e) {
    return apiError(e);
  }
}
