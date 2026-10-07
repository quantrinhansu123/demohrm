import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const serverEnv = {
  get supabaseUrl(): string {
    return required("SUPABASE_URL");
  },
  get supabaseKey(): string {
    return process.env["SUPABASE_SERVICE_ROLE_KEY"] || required("SUPABASE_ANON_KEY");
  },
  get authSecret(): string {
    return required("AUTH_SECRET");
  },
  get handoverSecret(): string {
    return required("HANDOVER_SECRET");
  },
  get publicAppUrl(): string {
    return process.env["PUBLIC_APP_URL"] ?? "http://localhost:3005";
  },
  sessionTtlHours: 12,
};
