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
