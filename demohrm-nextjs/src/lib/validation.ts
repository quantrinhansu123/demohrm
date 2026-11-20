import { z } from "zod";

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field !== undefined && !map[String(field)]) {
      map[String(field)] = issue.message;
    }
  }
  return map;
}

const PHONE_REGEX = /^(0|\+84)[0-9]{9}$/;

const currentYear = new Date().getFullYear();

export const CreateWorkerSchema = z.object({
  name: z.string().trim().max(100, "Họ và tên quá dài").optional().nullable(),
  phone: z.string().trim().min(1, "Số điện thoại không được để trống").regex(PHONE_REGEX, "Số điện thoại phải gồm 10 chữ số hợp lệ (VD: 0901234567)"),
  citizenId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => !value || /^[0-9]{12}$/.test(value), "CCCD phải gồm đúng 12 chữ số"),
  birthYear: z
    .string()
    .trim()
    .min(1, "Năm sinh không được để trống")
    .regex(/^\d{4}$/, "Năm sinh gồm 4 chữ số")
    .refine((value) => {
      const year = Number(value);
      return year >= 1940 && year <= currentYear;
    }, `Năm sinh từ 1940 đến ${currentYear}`),
  hometown: z.string().trim().min(1, "Nơi ở không được để trống").max(200, "Nơi ở quá dài"),
  company: z.string().optional().nullable(),
  type: z.string().default("Thời vụ"),
  source: z.string().optional(),
  sale: z.string().trim().min(1, "Vui lòng chọn nhân viên tư vấn"),
  manager: z.string().optional().nullable(),
  consultDate: z
    .string()
    .trim()
    .min(1, "Ngày tư vấn không được để trống")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày tư vấn theo dạng YYYY-MM-DD"),
  startWorkDate: z.string().optional().nullable(),
});

export const EditWorkerSchema = z.object({
  name: z.string().trim().min(2, "Họ và tên phải từ 2 ký tự"),
  phone: z.string().trim().min(1, "Số điện thoại không được để trống").regex(PHONE_REGEX, "Số điện thoại phải gồm 10 chữ số hợp lệ"),
  hometown: z.string().optional().nullable(),
  position: z.string().optional(),
  type: z.string(),
  status: z.string(),
  sale: z.string().trim().min(1, "Vui lòng chọn sale"),
  manager: z.string().trim().min(1, "Vui lòng chọn phụ trách"),
});

export const AddPlacementSchema = z.object({
  orderCode: z.string().trim().min(1, "Vui lòng chọn đơn hàng"),
  startDate: z.string().trim().min(1, "Vui lòng chọn ngày bắt đầu"),
  position: z.string().optional(),
});

export const ClosePlacementSchema = z
  .object({
    startDate: z.string().trim(),
    endDate: z.string().trim().min(1, "Vui lòng chọn ngày kết thúc"),
    endReason: z.string().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "Ngày kết thúc không được trước ngày vào",
    path: ["endDate"],
  });