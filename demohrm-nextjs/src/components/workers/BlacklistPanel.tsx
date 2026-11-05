"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fetchLiveWorkers, toWorker, updateLiveWorker, VI_STATUS } from "@/lib/live";
import { maskCitizenId, workerStatusTone } from "@/lib/format";
import { BLACKLIST_STATUS, workerStatusLabel } from "@/lib/worker-status";
import type { Worker } from "@/types/hrm";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

const PAGE = 50;

const EDIT_STATUSES = [
  "Blacklist",
  "Đang làm",
  "Chờ đi làm",
  "Tạm nghỉ",
  "Nghỉ việc",
  "Không đi làm",
  "Đang tư vấn",
] as const;

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12);
}

export function BlacklistPanel() {
  const { access } = useSession();
  const canWrite = access.canManageBlacklist;
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Worker | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchLiveWorkers({
        statusEn: BLACKLIST_STATUS,
        q: qDebounced || undefined,
        limit: PAGE,
        offset,
      });
      setRows(page.rows.map(toWorker));
      setTotal(page.total);
      setError("");
    } catch (e) {
      setError(errorText(e, "Không tải được blacklist."));
    } finally {
      setLoading(false);
    }
  }, [qDebounced, offset]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo CCCD hoặc tên"
          className="w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
        />
        <span className="ml-auto text-[13px] text-slate-500">
          Tổng số: <strong className="text-slate-900">{total}</strong>
        </span>
      </div>
      <QueryState loading={loading} error={error}>
        <DataTable headers={["Mã", "Họ và tên", "CCCD", "Trạng thái", "Thao tác"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <code className="text-[13px]">{row.code}</code>
              </td>
              <td>
                <strong className="text-slate-900">{row.name}</strong>
              </td>
              <td>
                <code>{maskCitizenId(row.citizenId, access.canViewCccd)}</code>
              </td>
              <td className="w-[1%] whitespace-nowrap">
                <StatusPill tone={workerStatusTone(row.status)}>{row.status}</StatusPill>
              </td>
              <td>
                {canWrite ? (
                  <Button variant="outline" size="xs" onClick={() => setEditing(row)}>
                    Sửa
                  </Button>
                ) : (
                  <span className="text-[12px] text-slate-400">Chỉ xem</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={5} text="Chưa có hồ sơ Blacklist" />}
        </DataTable>
        <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
          <Button variant="outline" size="xs" disabled={offset === 0} onClick={() => setOffset((n) => Math.max(0, n - PAGE))}>
            Trước
          </Button>
          <span>
            {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + PAGE, total)}`} / {total}
          </span>
          <Button variant="outline" size="xs" disabled={offset + PAGE >= total} onClick={() => setOffset((n) => n + PAGE)}>
            Sau
          </Button>
        </div>
      </QueryState>

      {editing ? (
        <BlacklistEditModal
          worker={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function BlacklistEditModal({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(worker.name);
  const [cccd, setCccd] = useState(digitsOnly(worker.citizenId));
  const [status, setStatus] = useState(worker.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (name.trim().length < 2) {
      setError("Nhập họ và tên.");
      return;
    }
    const nationalId = digitsOnly(cccd);
    if (!/^\d{9,12}$/.test(nationalId)) {
      setError("CCCD phải gồm 9–12 chữ số.");
      return;
    }
    const statusEn = VI_STATUS[status] ?? status;
    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(worker.id, {
        full_name: name.trim(),
        national_id: nationalId,
        status: statusEn,
      });
      await onSaved();
    } catch (e) {
      setError(errorText(e, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sửa blacklist ${worker.code}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" disabled={saving} onClick={() => void submit()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <div className="grid gap-3">
        <Field label="Họ và tên *">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="CCCD *">
          <input
            className={inputClass}
            value={cccd}
            onChange={(e) => setCccd(digitsOnly(e.target.value))}
            inputMode="numeric"
          />
        </Field>
        <Field label="Trạng thái *">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as Worker["status"])}>
            {EDIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-slate-500">
            Đổi khỏi Blacklist (vd. Nghỉ việc) để gỡ khỏi danh sách. Hiện: {workerStatusLabel(VI_STATUS[status] ?? status)}.
          </p>
        </Field>
      </div>
    </Modal>
  );
}
