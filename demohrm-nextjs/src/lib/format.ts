export function formatVND(num: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(num)} VNĐ`;
}

export function maskCitizenId(cccd: string, hasPermission: boolean): string {
  if (hasPermission) return cccd;
  return `${cccd.substring(0, 6)}******`;
}

/** Ẩn SĐT công nhân khi không đủ quyền (giữ 3 số cuối). */
export function maskPhone(phone: string, hasPermission: boolean): string {
  if (hasPermission) return phone;
  const raw = phone.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-3)}`;
}

export function workerStatusTone(status: string): "success" | "warning" | "info" | "danger" {
  if (status === "Chờ đi làm") return "warning";
  if (status === "Tạm nghỉ" || status === "Đang tư vấn" || status === "Ứng viên") return "info";
  if (status === "Nghỉ việc" || status === "Không đi làm") return "danger";
  return "success";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}
