import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { PEOPLE, expectNav, openPersonnel, openWorkers, shot, signIn } from "./helpers";
import type { Role } from "./helpers";

type NavExpectation = {
  finance: boolean;
  advances: boolean;
  commission: boolean;
  audit: boolean;
  manageAccounts: boolean;
  deletePersonnel: boolean;
};

const EXPECTED: Record<Role, NavExpectation> = {
  director: { finance: true, advances: true, commission: true, audit: true, manageAccounts: true, deletePersonnel: true },
  deputy_director: { finance: true, advances: true, commission: true, audit: true, manageAccounts: true, deletePersonnel: true },
  tech: { finance: true, advances: true, commission: true, audit: true, manageAccounts: true, deletePersonnel: true },
  admin: { finance: false, advances: false, commission: false, audit: false, manageAccounts: true, deletePersonnel: false },
  accountant: { finance: true, advances: true, commission: false, audit: false, manageAccounts: false, deletePersonnel: false },
  team_lead: { finance: false, advances: false, commission: false, audit: true, manageAccounts: false, deletePersonnel: false },
  recruiter: { finance: false, advances: true, commission: false, audit: false, manageAccounts: false, deletePersonnel: false },
  coordinator: { finance: false, advances: false, commission: false, audit: false, manageAccounts: false, deletePersonnel: false },
};

async function openFirstPersonnelMenu(page: Page) {
  await page.locator("article").first().getByRole("button", { name: "Thao tác nhân sự" }).click();
}

test("chưa đăng nhập thì hiện màn hình đăng nhập", async ({ page }, testInfo) => {
  await page.goto("/nhan-su");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
  await shot(page, testInfo, "00-chua-dang-nhap");
});

for (const role of Object.keys(PEOPLE) as Role[]) {
  test(`sidebar và nút tạo tài khoản - ${role}`, async ({ page }, testInfo) => {
    await signIn(page, role);
    await openPersonnel(page);
    const expected = EXPECTED[role];

    await expectNav(page, "Tài chính (Thu/Chi)", expected.finance);
    await expectNav(page, "Tạm ứng", expected.advances);
    await expectNav(page, "Hoa hồng dự kiến", expected.commission);
    await expectNav(page, "Lịch sử thao tác (Audit)", expected.audit);

    const addAccount = page.getByRole("button", { name: "+ Thêm tài khoản" });
    await expect(addAccount).toHaveCount(expected.manageAccounts ? 1 : 0);

    await shot(page, testInfo, `01-${role}-nhan-su`);

    await openFirstPersonnelMenu(page);
    await expect(page.getByRole("button", { name: "Xem", exact: true })).toBeVisible();
    if (expected.deletePersonnel) {
      await expect(page.getByRole("button", { name: "Xóa", exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("Xóa (BGĐ/KT)")).toBeVisible();
    }
    await shot(page, testInfo, `02-${role}-menu-nhan-su`, false);
  });
}

for (const role of ["director", "admin", "recruiter"] as Role[]) {
  test(`chi tiết nhân sự và nút đặt lại PIN - ${role}`, async ({ page }, testInfo) => {
    await signIn(page, role);
    await openPersonnel(page);
    await openFirstPersonnelMenu(page);
    await page.getByRole("button", { name: "Xem", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const expected = EXPECTED[role].manageAccounts;
    await expect(page.getByRole("button", { name: "Đặt lại PIN" })).toHaveCount(expected ? 1 : 0);
    if (expected) {
      await page.getByRole("button", { name: "Đặt lại PIN" }).click();
      await page.getByRole("button", { name: "Đặt lại PIN" }).first().click();
      await expect(page.getByText("Mật khẩu mới tối thiểu 4 ký tự.")).toBeVisible();
    }
    await shot(page, testInfo, `03-${role}-chi-tiet-nhan-su`);
  });
}

for (const role of ["director", "admin", "accountant", "recruiter"] as Role[]) {
  test(`che SĐT và CCCD công nhân - ${role}`, async ({ page }, testInfo) => {
    await signIn(page, role);
    await openWorkers(page);
    const firstRow = page.locator("tbody tr").first();
    const phoneCell = firstRow.locator("td").nth(1);
    const cccdCell = firstRow.locator("td").nth(3);

    if (role === "director" || role === "admin") {
      await expect(phoneCell).toContainText("0776442264");
      await expect(cccdCell).not.toContainText("******");
    } else if (role === "recruiter") {
      await expect(phoneCell).toContainText("***264");
      await expect(cccdCell).not.toContainText("******");
    } else {
      await expect(phoneCell).toContainText("***264");
      await expect(cccdCell).toContainText("******");
    }

    await shot(page, testInfo, `04-${role}-danh-sach-cong-nhan`);

    await firstRow.getByRole("button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const hiddenNote = dialog.getByText("Số điện thoại đang bị che — chỉ người nhập hồ sơ, người phụ trách, HCNS hoặc ban lãnh đạo/kỹ thuật được xem.");
    if (role === "director" || role === "admin") {
      await expect(hiddenNote).toHaveCount(0);
    } else {
      await expect(hiddenNote).toBeVisible();
    }
    await shot(page, testInfo, `05-${role}-chi-tiet-cong-nhan`);
  });
}

test("kế toán xem được tài chính và tạm ứng", async ({ page }, testInfo) => {
  await signIn(page, "accountant");
  await page.goto("/tai-chinh");
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tài chính", exact: true })).toBeVisible();
  await shot(page, testInfo, "06-accountant-tai-chinh");

  await page.goto("/tam-ung");
  await expect(page.getByRole("heading", { name: "Tạm ứng", exact: true })).toBeVisible();
  await shot(page, testInfo, "07-accountant-tam-ung");
});

test("nhân viên sale chỉ xem được tạm ứng", async ({ page }, testInfo) => {
  await signIn(page, "recruiter");
  await page.goto("/tam-ung");
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tạm ứng", exact: true })).toBeVisible();
  await shot(page, testInfo, "08-recruiter-tam-ung");
});
