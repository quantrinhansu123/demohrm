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

export const CreateWorkerSchema = z.object({
  name: z.string().trim().min(2, "Họ và tên phải từ 2 ký tự").max(100, "Họ và tên quá dài"),
  phone: z.string().trim().min(1, "Số điện thoại không được để trống").regex(PHONE_REGEX, "Số điện thoại phải gồm 10 chữ số hợp lệ (VD: 0901234567)"),
  citizenId: z.string().trim().min(1, "CCCD không được để trống").regex(/^[0-9]{12}$/, "CCCD phải gồm đúng 12 chữ số"),
  dob: z.string().optional().nullable(),
  hometown: z.string().optional().nullable(),
  company: z.string().trim().min(1, "Vui lòng chọn công ty"),
  type: z.string().default("Thời vụ"),
  source: z.string().optional(),
  sale: z.string().trim().min(1, "Vui lòng chọn sale"),
  manager: z.string().trim().min(1, "Vui lòng chọn phụ trách"),
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