export const runtime = "nodejs";

import { json } from "@/lib/server/http";

export async function GET(): Promise<Response> {
  return json({ ok: true, service: "trangway-nextjs", time: new Date().toISOString() });
}
