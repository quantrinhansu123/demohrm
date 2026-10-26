import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

export type Role =
  | "director"
  | "deputy_director"
  | "tech"
  | "admin"
  | "accountant"
  | "team_lead"
  | "recruiter"
  | "coordinator";

export interface SessionStaff {
  id: number;
  code: string;
  full_name: string;
  role: string;
  title: string | null;
}

export const PEOPLE: Record<Role, SessionStaff> = {
  director: { id: 5, code: "NV-005", full_name: "Nguyễn Thị Trang", role: "director", title: "Giám đốc" },
  deputy_director: { id: 4, code: "NV-004", full_name: "Phùng Văn Trường", role: "deputy_director", title: "Phó giám đốc" },
  tech: { id: 23, code: "NV-010", full_name: "Lương Tuấn Anh", role: "tech", title: "Kỹ thuật" },
  admin: { id: 1, code: "NV-001", full_name: "Nguyễn Thị Phương Nhung", role: "admin", title: "Hành chính nhân sự" },
  accountant: { id: 6, code: "NV-006", full_name: "Trịnh Hải Biển", role: "accountant", title: "Kế toán" },
  team_lead: { id: 21, code: "NV-008", full_name: "Nguyễn Văn Tài", role: "team_lead", title: "Quản lý team" },
  recruiter: { id: 20, code: "NV-007", full_name: "Đỗ Hoài Sơn", role: "recruiter", title: "Nhân viên sale" },
  coordinator: { id: 22, code: "NV-009", full_name: "Lê Thị Thêu", role: "coordinator", title: "Điều phối" },
};

const SCREENSHOT_DIR = path.join(process.cwd(), "playwright-screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function authSecret(): string {
  const fileEnv = {
    ...readEnvFile(path.join(process.cwd(), ".env")),
    ...readEnvFile(path.join(process.cwd(), ".env.local")),
  };
  const secret = process.env.AUTH_SECRET ?? fileEnv.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET in demohrm-nextjs/.env.local");
  return secret;
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

export function sessionFor(role: Role): { token: string; staff: SessionStaff } {
  const staff = PEOPLE[role];
  const payload = {
    typ: "session",
    sid: staff.id,
    role,
    exp: Date.now() + 6 * 3600_000,
  };
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return { token: `${body}.${signature}`, staff };
}

export async function signIn(page: Page, role: Role): Promise<void> {
  const session = sessionFor(role);
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("tw_session", JSON.stringify(value));
  }, session);
}

export async function waitWorkspace(page: Page): Promise<void> {
  await expect(page.locator("aside")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Đang kiểm tra phiên...")).toHaveCount(0);
}

export async function openPersonnel(page: Page): Promise<void> {
  await page.goto("/nhan-su");
  await waitWorkspace(page);
  await expect(page.getByRole("heading", { name: "Nhân sự", exact: true })).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
}

export async function openWorkers(page: Page): Promise<void> {
  await page.goto("/nguoi-lao-dong");
  await waitWorkspace(page);
  await expect(page.getByRole("heading", { name: "Hồ sơ Người lao động", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
}

export async function expectNav(page: Page, label: string, visible: boolean): Promise<void> {
  const item = page.locator("aside nav button").filter({ hasText: label });
  if (visible) {
    await expect(item).toHaveCount(1);
  } else {
    await expect(item).toHaveCount(0);
  }
}

export async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = true): Promise<void> {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage, animations: "disabled" });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}
