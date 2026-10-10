import "server-only";

export const ROLE = {
  finance: ["director", "deputy_director", "accountant"],
  commission: ["director", "deputy_director"],
  audit: ["director", "deputy_director", "team_lead"],
  cccd: ["director", "deputy_director", "recruiter"],
  closePeriod: ["director", "deputy_director", "accountant"],
  personnelDelete: ["director", "deputy_director"],
  staffPinReset: ["director", "deputy_director"],
} as const;

export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
  return Boolean(role) && allowed.includes(role as string);
}
