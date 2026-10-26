import { expect, test } from "@playwright/test";
import type { APIRequestContext, TestInfo } from "@playwright/test";
import { sessionFor } from "./helpers";
import type { Role } from "./helpers";

function headers(role: Role): Record<string, string> {
  return { Authorization: `Bearer ${sessionFor(role).token}` };
}

async function evidence(testInfo: TestInfo, name: string, status: number, body: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify({ status, body }, null, 2),
    contentType: "application/json",
  });
}

async function readJson(res: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

test("API che SĐT công nhân theo vai trò", async ({ request }, testInfo) => {
  const recruiter = await request.get("/api/v1/workers?limit=5", { headers: headers("recruiter") });
  expect(recruiter.ok()).toBeTruthy();
  const recruiterBody = (await recruiter.json()) as { rows: Array<Record<string, unknown>> };
  const recruiterRow = recruiterBody.rows.find((row) => row.id === 7) ?? recruiterBody.rows[0];
  expect(recruiterRow.phone).toBe("***264");
  expect(recruiterRow.phone_hidden).toBe(true);
  expect(recruiterRow.national_id_full).toBeTruthy();
  await evidence(testInfo, "recruiter-workers", recruiter.status(), recruiterRow);

  const accountant = await request.get("/api/v1/workers?limit=5", { headers: headers("accountant") });
  expect(accountant.ok()).toBeTruthy();
  const accountantBody = (await accountant.json()) as { rows: Array<Record<string, unknown>> };
  const accountantRow = accountantBody.rows.find((row) => row.id === 7) ?? accountantBody.rows[0];
  expect(accountantRow.phone).toBe("***264");
  expect(accountantRow.phone_hidden).toBe(true);
  expect(accountantRow.national_id_full).toBeUndefined();
  await evidence(testInfo, "accountant-workers", accountant.status(), accountantRow);

  const director = await request.get("/api/v1/workers?limit=5", { headers: headers("director") });
  expect(director.ok()).toBeTruthy();
  const directorBody = (await director.json()) as { rows: Array<Record<string, unknown>> };
  const directorRow = directorBody.rows.find((row) => row.id === 7) ?? directorBody.rows[0];
  expect(directorRow.phone).toBe("0776442264");
  expect(directorRow.phone_hidden).toBe(false);
  expect(directorRow.national_id_full).toBeTruthy();
  await evidence(testInfo, "director-workers", director.status(), directorRow);
});

test("API chặn recruiter sửa SĐT hồ sơ không thuộc phạm vi", async ({ request }, testInfo) => {
  const res = await request.patch("/api/v1/workers/7", {
    headers: headers("recruiter"),
    data: { phone: "0776442264" },
  });
  const body = await readJson(res);
  await evidence(testInfo, "recruiter-patch-phone", res.status(), body);
  expect(res.status()).toBe(403);
});

test("API cho phép quản lý sửa SĐT công nhân", async ({ request }, testInfo) => {
  const res = await request.patch("/api/v1/workers/7", {
    headers: headers("director"),
    data: { phone: "0776442264" },
  });
  const body = await readJson(res);
  await evidence(testInfo, "director-patch-phone", res.status(), body);
  expect(res.ok()).toBeTruthy();
});

test("API chặn recruiter tạo tài khoản nhân sự", async ({ request }, testInfo) => {
  const res = await request.post("/api/v1/staff", {
    headers: headers("recruiter"),
    data: { full_name: "Kiểm thử quyền", department: "Nhân viên", pin: "1234" },
  });
  const body = await readJson(res);
  await evidence(testInfo, "recruiter-create-staff", res.status(), body);
  expect(res.status()).toBe(403);
});

test("API chặn recruiter sửa hồ sơ nhân sự", async ({ request }, testInfo) => {
  test.fail(true, "PATCH /api/v1/staff/:id chưa gọi requireRole(ROLE.accountManage) nên recruiter nhận 404 thay vì 403.");
  const res = await request.patch("/api/v1/staff/999999", {
    headers: headers("recruiter"),
    data: { full_name: "Kiểm thử quyền", department: "Nhân viên", status: "active" },
  });
  const body = await readJson(res);
  await evidence(testInfo, "recruiter-patch-staff", res.status(), body);
  expect(res.status()).toBe(403);
});

test("API chặn recruiter đặt lại PIN", async ({ request }, testInfo) => {
  const res = await request.post("/api/v1/staff/999999/reset-pin", {
    headers: headers("recruiter"),
    data: { new_pin: "1234" },
  });
  const body = await readJson(res);
  await evidence(testInfo, "recruiter-reset-pin", res.status(), body);
  expect(res.status()).toBe(403);
});

test("API chặn recruiter xóa nhân sự", async ({ request }, testInfo) => {
  const res = await request.delete("/api/v1/staff/999999", { headers: headers("recruiter") });
  const body = await readJson(res);
  await evidence(testInfo, "recruiter-delete-staff", res.status(), body);
  expect(res.status()).toBe(403);
});

test("API chỉ cho Ban lãnh đạo và Kỹ thuật quản lý hoa hồng", async ({ request }, testInfo) => {
  for (const role of ["recruiter", "accountant"] as Role[]) {
    const list = await request.get("/api/v1/commissions?period=2026-10", { headers: headers(role) });
    await evidence(testInfo, `${role}-commissions-list`, list.status(), await readJson(list));
    expect(list.status(), `${role} GET commissions`).toBe(403);

    const create = await request.post("/api/v1/commissions", {
      headers: headers(role),
      data: { company_name: "Kiểm thử quyền", unit_price: 1000, period_code: "2026-10" },
    });
    await evidence(testInfo, `${role}-commissions-create`, create.status(), await readJson(create));
    expect(create.status(), `${role} POST commissions`).toBe(403);

    const update = await request.patch("/api/v1/commissions/999999", {
      headers: headers(role),
      data: { unit_price: 1000 },
    });
    await evidence(testInfo, `${role}-commissions-update`, update.status(), await readJson(update));
    expect(update.status(), `${role} PATCH commissions`).toBe(403);
  }
});

test("API chỉ cho Ban lãnh đạo và Kỹ thuật xóa dữ liệu", async ({ request }, testInfo) => {
  const endpoints = [
    "/api/v1/staff/999999",
    "/api/v1/workers/999999",
    "/api/v1/companies/999999",
    "/api/v1/orders/999999",
    "/api/v1/vendors/999999",
    "/api/v1/cashbook/999999",
    "/api/v1/advances/999999",
    "/api/v1/commissions/999999",
  ];
  for (const role of ["recruiter", "accountant"] as Role[]) {
    for (const endpoint of endpoints) {
      const res = await request.delete(endpoint, { headers: headers(role) });
      await evidence(testInfo, `${role}-delete-${endpoint.split("/")[3]}`, res.status(), await readJson(res));
      expect(res.status(), `${role} ${endpoint}`).toBe(403);
    }
  }
});
