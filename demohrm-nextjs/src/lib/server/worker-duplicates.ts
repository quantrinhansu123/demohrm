import "server-only";

import { getSupabase } from "@/lib/server/db";
import { RESIGNED_STATUS, workerStatusLabel } from "@/lib/worker-status";

// Rule thay UNIQUE DB: CCCD/SĐT chỉ được trùng khi mọi hồ sơ cũ đã Nghỉ việc.
const UNIQUE_FIELDS = [
  { column: "national_id", label: "CCCD" },
  { column: "phone", label: "SĐT" },
] as const;

type UniqueColumn = (typeof UNIQUE_FIELDS)[number]["column"];

export interface BlockingDuplicate {
  field: UniqueColumn;
  message: string;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Hồ sơ chưa nghỉ việc có cùng CCCD hoặc SĐT; các cột kiểm tra chạy song song.
export async function findBlockingDuplicate(values: Partial<Record<UniqueColumn, unknown>>): Promise<BlockingDuplicate | null> {
  const checks = UNIQUE_FIELDS.flatMap(({ column, label }) => {
    const value = asText(values[column]);
    if (!value) return [];
    return [
      Promise.resolve(
        getSupabase()
          .from("workers")
          .select("code,full_name,status")
          .eq(column, value)
          .neq("status", RESIGNED_STATUS)
          .limit(1)
          .maybeSingle(),
      ).then(({ data, error }) => {
        if (error) throw error;
        if (!data) return null;
        return {
          field: column,
          message: `${label} đã thuộc hồ sơ ${data.code} (${data.full_name}, ${workerStatusLabel(data.status as string)}) chưa nghỉ việc nên không tạo mới được.`,
        } satisfies BlockingDuplicate;
      }),
    ];
  });
  const found = await Promise.all(checks);
  return found.find((hit): hit is BlockingDuplicate => hit !== null) ?? null;
}
