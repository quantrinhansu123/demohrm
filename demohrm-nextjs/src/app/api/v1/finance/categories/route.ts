export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const { data, error } = await getSupabase().from("finance_categories").select("id,name").order("name").limit(100);
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}
