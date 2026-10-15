import type { WorkerStatus } from "@/types/hrm";

// Nguồn duy nhất cho trạng thái hồ sơ NLĐ (giá trị DB -> nhãn hiển thị).
export const WORKER_STATUS_LABEL: Record<string, WorkerStatus> = {
  working: "Đang làm",
  waiting_start: "Chờ đi làm",
  on_leave: "Tạm nghỉ",
  resigned: "Nghỉ việc",
  no_show: "Không đi làm",
  candidate: "Đang tư vấn",
};

// Hồ sơ đã nghỉ việc: được tạo hồ sơ mới / tái tuyển dụng dù trùng CCCD, SĐT.
export const RESIGNED_STATUS = "resigned";

export function workerStatusLabel(status?: string | null): string {
  return (status && WORKER_STATUS_LABEL[status]) || status || "không rõ";
}
