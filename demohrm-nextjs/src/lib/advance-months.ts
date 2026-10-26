const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonthCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return MONTH_RE.test(trimmed) ? trimmed : null;
}

export function monthCodeFromDate(date: string): string | null {
  const trimmed = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed.slice(0, 7);
}

export function monthBounds(monthCode: string): { from: string; to: string } | null {
  const month = parseMonthCode(monthCode);
  if (!month) return null;
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) return null;
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    from: `${year}-${pad(monthIndex)}-01`,
    to: `${year}-${pad(monthIndex)}-${pad(lastDay)}`,
  };
}

export function nextMonthCode(monthCode: string): string | null {
  const month = parseMonthCode(monthCode);
  if (!month) return null;
  const [yearRaw, monthRaw] = month.split("-");
  let year = Number(yearRaw);
  let monthIndex = Number(monthRaw) + 1;
  if (monthIndex > 12) {
    monthIndex = 1;
    year += 1;
  }
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

export function currentMonthCode(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM → mm/yyyy */
export function formatMonthLabel(monthCode: string): string {
  const [year, month] = monthCode.split("-");
  if (!year || !month) return monthCode;
  return `${month}/${year}`;
}

export function formatClosedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour12: false });
}

/** Số ngày giữa from/to (YYYY-MM-DD), inclusive-ish for range size checks. */
export function daysBetween(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86_400_000) + 1;
}
