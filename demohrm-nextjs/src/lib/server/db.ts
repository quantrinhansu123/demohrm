import "server-only";

import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/server/env";

// Schema mac dinh `trangway` (Supabase Data API phai expose schema nay).
export function getSupabase() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseKey, {
    db: { schema: "trangway" },
    auth: { persistSession: false },
  });
}
