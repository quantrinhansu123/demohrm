"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useApp } from "@/lib/store";
import {
  createLiveCommission,
  deleteLiveCommission,
  fetchLiveCommissions,
  fetchLiveWorkers,
  updateLiveCommission,
} from "@/lib/live";
import type { LiveCommission, LiveWorkerRow } from "@/lib/live";
import { formatVND, maskCitizenId } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { SuggestInput } from "@/components/ui/suggest-input";

function num(v: number | string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function companyKey(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("vi");
}

function buildWorkerCounts(
  workers: LiveWorkerRow[],
  companies: Array<{ short_name: string; name?: string | null }>,
): Map<string, number> {
  const byCompany = new Map<string, number>();
  for (const worker of workers) {
    const key = companyKey(worker.company);
    if (!key) continue;
    byCompany.set(key, (byCompany.get(key) ?? 0) + 1);
  }
  // Alias full name → same count as short_name for form preview lookup
  for (const company of companies) {
    const shortKey = companyKey(company.short_name);
    const fullKey = companyKey(company.name);
    const count = byCompany.get(shortKey) ?? byCompany.get(fullKey);
    if (count == null) continue;
    if (shortKey) byCompany.set(shortKey, count);
    if (fullKey) byCompany.set(fullKey, count);
  }
  return byCompany;
}

function workerCountFor(counts: Map<string, number>, companyName: string): number {
  return counts.get(companyKey(companyName)) ?? 0;
}

async function fetchAllWorkingWorkers(): Promise<LiveWorkerRow[]> {
  const limit = 200;
  const first = await fetchLiveWorkers({ statusEn: "working", limit, offset: 0 });
  const rows = [...first.rows];
  const total = first.total ?? rows.length;
  for (let offset = limit; offset < total && offset < 5000; offset += limit) {
    const page = await fetchLiveWorkers({ statusEn: "working", limit, offset });
    rows.push(...page.rows);
    if (page.rows.length < limit) break;
  }
  return rows;
}

interface CommissionForm {
  company_name: string;
  unit_price: string;
}

function emptyForm(): CommissionForm {
  return { company_name: "", unit_price: "" };
}

function formFromRow(row: LiveCommission): CommissionForm {
  return {
    company_name: row.company_name,
    unit_price: String(row.unit_price ?? ""),
  };
}

export function CommissionView() {
  const { periodCode, periods, companies } = useApp();
  const { access } = useSession();
  const canDelete = access.canDelete;
  const [rows, setRows] = useState<LiveCommission[]>([]);
  const [workingWorkers, setWorkingWorkers] = useState<LiveWorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LiveCommission | null>(null);
  const [viewingCompany, setViewingCompany] = useState<string | null>(null);
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? periodCode;

  const reload = useCallback(async () => {
    if (!periodCode) return;
    setLoading(true);
    try {
      const [commissionRows, workers] = await Promise.all([
        fetchLiveCommissions(periodCode),
        fetchAllWorkingWorkers(),
      ]);
      setRows(commissionRows);
      setWorkingWorkers(workers);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được hoa hồng.");
    } finally {
      setLoading(false);
    }
  }, [periodCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => buildWorkerCounts(workingWorkers, companies), [workingWorkers, companies]);
  const suggestions = useMemo(() => {
    const names = new Set<string>();
    for (const company of companies) {
      if (company.short_name?.trim()) names.add(company.short_name.trim());
      if (company.name?.trim()) names.add(company.name.trim());
    }
    for (const worker of workingWorkers) {
      if (worker.company?.trim()) names.add(worker.company.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b, "vi"));
  }, [companies, workingWorkers]);

  const total = rows.reduce((s, r) => s + num(r.commission_amount), 0);
  const workers = rows.reduce((s, r) => s + num(r.worker_count), 0);

  const handleDelete = async (row: LiveCommission) => {
    if (!window.confirm(`Xóa hoa hồng ${row.company_name}?`)) return;
    try {
      await deleteLiveCommission(row.id);
      await reload();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa thất bại.");
    }
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Hoa hồng dự kiến"
        sub={`${periodName} · Đơn giá × tổng công nhân đang làm trong công ty`}
        actions={
          <Button
            size="sm"
            className="bg-[#0052cc] text-white hover:bg-[#0747a6]"
            onClick={() => setCreating(true)}
          >
            + Thêm hoa hồng
          </Button>
        }
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="TỔNG HOA HỒNG" value={formatVND(total)} valueClassName="text-violet-700" sub={`${rows.length} công ty`} />
            <KpiCard title="TỔNG CÔNG NHÂN" value={<>{workers} <span className="text-[14px] font-medium text-slate-400">người</span></>} sub="Đang làm trong các công ty có hoa hồng" />
            <KpiCard title="SỐ CÔNG TY" value={<>{rows.length}</>} sub={`Kỳ ${periodCode}`} />
          </div>
          <div className="mt-4">
            <DataTable headers={["Công ty", "Đơn giá / công", "Công nhân hiện tại", "Hoa hồng dự kiến", "Thao tác"]}>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.company_name}</strong></td>
                  <td>{formatVND(num(row.unit_price))}</td>
                  <td>{num(row.worker_count)}</td>
                  <td><strong className="text-violet-700">{formatVND(num(row.commission_amount))}</strong></td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => setViewingCompany(row.company_name)}>
                        Xem
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => setEditing(row)}>Sửa</Button>
                      {canDelete && (
                        <Button variant="destructive" size="xs" onClick={() => void handleDelete(row)}>Xóa</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow colSpan={5} text="Chưa cấu hình hoa hồng cho kỳ này" />}
            </DataTable>
          </div>
        </div>
      </QueryState>
      <CommissionFormModal
        key={editing ? `edit-${editing.id}` : creating ? "create" : "closed"}
        open={creating || editing !== null}
        title={editing ? `Sửa hoa hồng ${editing.company_name}` : "Thêm hoa hồng"}
        periodName={periodName}
        initial={editing ? formFromRow(editing) : emptyForm()}
        suggestions={suggestions}
        counts={counts}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={async (form) => {
          const body = {
            company_name: form.company_name.trim(),
            unit_price: Number(form.unit_price),
            period_code: periodCode,
          };
          if (editing) await updateLiveCommission(editing.id, body);
          else await createLiveCommission(body);
          await reload();
        }}
      />
      <CommissionWorkersModal
        companyName={viewingCompany}
        companies={companies}
        canViewCccd={access.canViewCccd}
        onClose={() => setViewingCompany(null)}
      />
    </section>
  );
}

function companyLookupKeys(
  companyName: string,
  companies: Array<{ short_name: string; name?: string | null }>,
): string[] {
  const key = companyKey(companyName);
  const match = companies.find(
    (company) => companyKey(company.short_name) === key || companyKey(company.name) === key,
  );
  return [...new Set([companyName.trim(), match?.short_name?.trim(), match?.name?.trim()].filter(Boolean))] as string[];
}

async function fetchWorkersForCompany(
  companyName: string,
  companies: Array<{ short_name: string; name?: string | null }>,
): Promise<LiveWorkerRow[]> {
  const keys = companyLookupKeys(companyName, companies);
  const pages = await Promise.all(
    keys.map((company) =>
      fetchLiveWorkers({ company, statusEn: "working", limit: 200 }),
    ),
  );
  const byId = new Map<number, LiveWorkerRow>();
  for (const page of pages) {
    for (const row of page.rows) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
}

function CommissionWorkersModal({
  companyName,
  companies,
  canViewCccd,
  onClose,
}: {
  companyName: string | null;
  companies: Array<{ short_name: string; name?: string | null }>;
  canViewCccd: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LiveWorkerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyName) return;
    let alive = true;
    setLoading(true);
    setError("");
    setRows([]);
    fetchWorkersForCompany(companyName, companies)
      .then((list) => {
        if (!alive) return;
        setRows(list);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Không tải được danh sách người lao động.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [companyName, companies]);

  return (
    <Modal
      open={Boolean(companyName)}
      onClose={onClose}
      title={companyName ? `Người lao động · ${companyName}` : "Người lao động"}
      wide
      footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <p className="mb-3 text-[12.5px] text-slate-500">
        Danh sách NLĐ đang làm tại công ty · {loading ? "Đang tải..." : `${rows.length} người`}
      </p>
      <DataTable headers={["Họ và tên", "Số điện thoại", "CCCD / Định danh"]}>
        {rows.map((row) => {
          const cccd = row.national_id_full ?? row.national_id_masked ?? "";
          return (
            <tr key={row.id}>
              <td>
                <strong className="text-slate-900">{row.full_name}</strong>
                <span className="mt-0.5 block text-[11.5px] text-slate-400">{row.code}</span>
              </td>
              <td><code className="text-[13px]">{row.phone || "—"}</code></td>
              <td><code className="text-[13px]">{cccd ? maskCitizenId(cccd, canViewCccd) : "—"}</code></td>
            </tr>
          );
        })}
        {!loading && rows.length === 0 && (
          <EmptyRow colSpan={3} text="Không có người lao động đang làm tại công ty này" />
        )}
      </DataTable>
    </Modal>
  );
}

function CommissionFormModal({
  open,
  title,
  periodName,
  initial,
  suggestions,
  counts,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  periodName: string;
  initial: CommissionForm;
  suggestions: string[];
  counts: Map<string, number>;
  onClose: () => void;
  onSave: (form: CommissionForm) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const workerCount = workerCountFor(counts, form.company_name);
  const unitPrice = Number(form.unit_price);
  const preview = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice * workerCount : 0;

  const set = <K extends keyof CommissionForm>(key: K, value: CommissionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const save = async () => {
    if (!form.company_name.trim()) {
      setError("Nhập tên công ty.");
      return;
    }
    const price = Number(form.unit_price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Đơn giá không hợp lệ.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <div className="grid gap-3">
        <Field label="Công ty *">
          <SuggestInput
            value={form.company_name}
            onChange={(value) => set("company_name", value)}
            suggestions={suggestions}
            placeholder="Chọn hoặc nhập tên công ty"
            createLabel="Dùng tên"
            disabled={saving}
          />
        </Field>
        <Field label="Đơn giá / công *">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.unit_price}
            onChange={(e) => set("unit_price", e.target.value)}
            placeholder="Ví dụ: 500000"
            disabled={saving}
          />
        </Field>
        <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-[13px] text-slate-700">
          <div className="flex justify-between gap-3">
            <span>Công nhân đang làm trong công ty</span>
            <strong className="text-slate-900">{workerCount} người</strong>
          </div>
          <div className="mt-1.5 flex justify-between gap-3">
            <span>Hoa hồng dự kiến</span>
            <strong className="text-violet-700">{formatVND(preview)}</strong>
          </div>
          <p className="mt-2 text-[12px] text-slate-500">
            Tính theo NLĐ đang làm tại công ty (cùng nguồn với nút Xem) · kỳ cấu hình {periodName}.
          </p>
        </div>
      </div>
    </Modal>
  );
}
