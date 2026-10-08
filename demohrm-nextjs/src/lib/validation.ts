import { z } from "zod";

/**
 * Chuyển Zod Error issues thành Map Record<fieldName, errorMessage>
 * để hiển thị trực tiếp lỗi dưới từng ô input
 */
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

// ---- 1. Schema Tạo hồ sơ Người lao động ----
export const CreateWorkerSchema = z.object({
  code: z.string().trim().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Họ và tên người lao động phải từ 2 ký tự")
    .max(100, "Họ và tên quá dài"),
  phone: z
    .string()
    .trim()
    .min(1, "Số điện thoại không được để trống")
    .refine((v) => /^(0|\+84)[0-9]{9,10}$/.test(v), "Số điện thoại phải gồm 10 hoặc 11 chữ số hợp lệ"),
  citizenId: z
    .string()
    .trim()
    .optional()
    .superRefine((v, ctx) => {
      if (!v) return;
      if (!/^[0-9]+$/.test(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CCCD chỉ được chứa các chữ số" });
      } else if (v.length !== 12 && v.length !== 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `CCCD phải gồm đúng 12 chữ số (bạn đang nhập ${v.length} số)`,
        });
      }
    }),
  company: z.string().trim().min(1, "Vui lòng chọn công ty tiếp nhận"),
  recruiter: z.string().trim().min(1, "Vui lòng chọn người phụ trách tuyển dụng"),
  supervisorId: z.string().optional(),
  type: z.string().default("Thời vụ"),
  dob: z.string().optional().nullable(),
  hometown: z.string().optional().nullable(),
});

// ---- 2. Schema Sửa hồ sơ Người lao động ----
export const EditWorkerSchema = z.object({
  name: z.string().trim().min(2, "Họ và tên phải từ 2 ký tự"),
  phone: z
    .string()
    .trim()
    .min(1, "Số điện thoại không được để trống")
    .regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$|^[0-9]{10}$/, "Số điện thoại phải gồm 10 chữ số hợp lệ"),
  position: z.string().trim().min(1, "Vui lòng nhập vị trí công việc"),
  citizenId: z
    .string()
    .optional()
    .refine((v) => !v || /^[0-9]{9}$|^[0-9]{12}$/.test(v), "CCCD phải gồm 9 hoặc 12 chữ số"),
  hometown: z.string().optional().nullable(),
  recruiterId: z.string().optional(),
  creatorId: z.string().optional(),
  createdAt: z.string().optional(),
  type: z.string(),
  status: z.string(),
});

// ---- 3. Schema Thêm đợt làm việc cho NLĐ ----
export const AddPlacementSchema = z.object({
  orderCode: z.string().trim().min(1, "Vui lòng chọn đơn hàng tiếp nhận"),
  startDate: z.string().trim().min(1, "Vui lòng chọn ngày bắt đầu làm việc"),
  position: z.string().optional(),
  supervisorId: z.string().optional(),
});

// ---- 4. Schema Tạo / Sửa đơn hàng ----
export const CreateOrderSchema = z.object({
  code: z.string().trim().min(2, "Mã đơn hàng không được để trống"),
  name: z.string().trim().min(2, "Tên đơn hàng không được để trống"),
  companyId: z.string().trim().min(1, "Vui lòng chọn công ty đối tác"),
  position: z.string().trim().min(1, "Vui lòng nhập vị trí tuyển dụng"),
  target: z
    .string()
    .refine((v) => Number(v) > 0, "Chỉ tiêu tuyển dụng phải lớn hơn 0"),
  start: z.string().trim().min(1, "Vui lòng chọn ngày bắt đầu tuyển"),
  end: z.string().optional(),
  siteId: z.string().optional(),
  ownerId: z.string().optional(),
  teamId: z.string().optional(),
  jobDesc: z.string().optional(),
  shiftDesc: z.string().optional(),
  dayRate: z
    .string()
    .optional()
    .refine((v) => !v || Number(v) >= 0, "Đơn giá ngày phải là số không âm"),
});

// ---- 5. Schema Dòng lương bổ sung / điều chỉnh ----
export const SalaryEntrySchema = z.object({
  workerId: z.string().trim().min(1, "Vui lòng chọn người lao động"),
  amount: z
    .string()
    .trim()
    .min(1, "Số tiền không được để trống")
    .refine((v) => Number(v) > 0, "Số tiền phải lớn hơn 0"),
  days: z
    .string()
    .optional()
    .refine((v) => !v || Number(v) >= 0, "Ngày công phải là số không âm"),
  rate: z
    .string()
    .optional()
    .refine((v) => !v || Number(v) >= 0, "Đơn giá ngày phải là số không âm"),
  type: z.string().default("supplement"),
  content: z.string().optional(),
  placementId: z.string().optional(),
  entryDate: z.string().optional(),
  reason: z.string().optional(),
});

// ---- 6. Schema Sổ thu chi tài chính ----
export const FinanceTxSchema = z.object({
  categoryId: z.string().trim().min(1, "Vui lòng chọn danh mục thu chi"),
  amount: z
    .string()
    .trim()
    .min(1, "Số tiền không được để trống")
    .refine((v) => Number(v) > 0, "Số tiền phải lớn hơn 0"),
  date: z.string().trim().min(1, "Vui lòng chọn ngày giao dịch"),
  type: z.enum(["income", "expense"]),
  companyId: z.string().optional(),
  description: z.string().optional(),
});

// ---- 7. Schema Kết thúc đợt làm việc ----
export const ClosePlacementSchema = z
  .object({
    startDate: z.string().trim(),
    endDate: z.string().trim().min(1, "Vui lòng chọn ngày kết thúc đợt"),
    endReason: z.string().trim().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "Ngày kết thúc không được trước ngày vào",
    path: ["endDate"],
  });

