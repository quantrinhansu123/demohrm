"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { DEPARTMENTS, departmentOf } from "@/lib/departments";
import { initialsOf } from "@/lib/format";
import { createLivePersonnel, deleteLivePersonnel, fetchLivePersonnel, updateLivePersonnel } from "@/lib/live";
import type { LivePersonnel, PersonnelWrite } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { AttendanceView } from "@/components/modules/AttendanceView";

const AVATAR_TONES = ["avatar-blue", "avatar-teal", "avatar-indigo", "avatar-emerald", "avatar-amber", "avatar-rose"];

function statusLabel(status: string): string {
  if (status === "active") return "Hoạt động";
  if (status === "inactive") return "Ngừng";
  return status;
}

interface PersonnelForm {
  full_name: string;
  department: string;
  phone: string;
  email: string;
  status: string;
}

function formFromPerson(person: LivePersonnel): PersonnelForm {
  return {
    full_name: person.full_name,
    department: departmentOf(person) ?? DEPARTMENTS[0].label,
    phone: person.phone ?? "",
    email: person.email ?? "",
    status: person.status === "inactive" ? "inactive" : "active",
  };
}

export function PersonnelView() {
  const [rows, setRows] = useState<LivePersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [pane, setPane] = useState<"people" | "attendance">("people");
  const [editing, setEditing] = useState<LivePersonnel | null>(null);
  const [viewing, setViewing] = useState<LivePersonnel | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLivePersonnel();
      setRows(data);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được nhân sự từ database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.code, r.email, r.phone, departmentOf(r)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [query, rows]);

  const groups = DEPARTMENTS.map((department) => ({
    ...department,
    people: filtered.filter((r) => departmentOf(r) === department.label),
  }));
  const unassigned = filtered.filter((r) => !departmentOf(r));
  const active = rows.filter((r) => r.status === "active").length;

  const handleDelete = async (person: LivePersonnel) => {
    if (!window.confirm(`Xóa ${person.full_name} (${person.code}) khỏi danh sách nhân sự?`)) return;
    try {
      await deleteLivePersonnel(person.id);
      if (viewing?.id === person.id) setViewing(null);
      await reload();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa thất bại.");
    }
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Nhân sự"
        sub={pane === "attendance" ? "Chấm công trên điện thoại" : `${rows.length} người · dữ liệu lấy từ bảng staff`}
        actions={
          <>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-semibold">
              <button type="button" onClick={() => setPane("people")} className={pane === "people" ? "rounded-md bg-white px-3 py-1 text-[#0052cc] shadow-sm" : "px-3 py-1 text-slate-500"}>Danh sách</button>
              <button type="button" onClick={() => setPane("attendance")} className={pane === "attendance" ? "rounded-md bg-white px-3 py-1 text-[#0052cc] shadow-sm" : "px-3 py-1 text-slate-500"}>Chấm công</button>
            </div>
            {pane === "people" && <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên, mã, SĐT..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />}
            {pane === "people" && (
              <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => setCreating(true)}>
                + Thêm
              </Button>
            )}
          </>
        }
      />
      {pane === "attendance" ? <AttendanceView embedded /> : (
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="TỔNG NHÂN SỰ" value={<>{rows.length}</>} sub="Đọc từ database" />
            <KpiCard title="ĐANG HOẠT ĐỘNG" value={<>{active}</>} sub={`${rows.length - active} tài khoản ngừng`} />
            <KpiCard title="PHÒNG BAN" value={<>{DEPARTMENTS.length}</>} sub="Giám đốc đến truyền thông" />
          </div>
          {groups.map((group) => (
            <div key={group.label} className="mt-4">
              <h2 className="mb-2 text-[14px] font-bold text-slate-800">{group.label} <span className="font-medium text-slate-400">· {group.people.length}</span></h2>
              <DataTable headers={["Nhân sự", "Mã", "Điện thoại", "Email", "Trạng thái", "Thao tác"]}>
                {group.people.map((person) => (
                  <PersonnelRow key={person.id} person={person} onView={setViewing} onEdit={setEditing} onDelete={handleDelete} />
                ))}
                {group.people.length === 0 && <EmptyRow colSpan={6} text="Chưa có nhân viên" />}
              </DataTable>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 text-[14px] font-bold text-slate-800">Chưa xếp phòng ban <span className="font-medium text-slate-400">· {unassigned.length}</span></h2>
              <DataTable headers={["Nhân sự", "Mã", "Điện thoại", "Email", "Trạng thái", "Thao tác"]}>
                {unassigned.map((person) => (
                  <PersonnelRow key={person.id} person={person} onView={setViewing} onEdit={setEditing} onDelete={handleDelete} />
                ))}
              </DataTable>
            </div>
          )}
        </div>
      </QueryState>
      )}
      <AddPersonnelModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => void reload()}
      />
      <EditPersonnelModal
        key={editing ? `edit-${editing.id}` : "edit-closed"}
        person={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
          if (viewing?.id === updated.id) setViewing(updated);
        }}
      />
      <PersonnelDetailModal
        person={viewing}
        onClose={() => setViewing(null)}
        onEdit={(person) => {
          setViewing(null);
          setEditing(person);
        }}
        onDelete={(person) => void handleDelete(person)}
      />
    </section>
  );
}

function PersonnelRow({
  person,
  onView,
  onEdit,
  onDelete,
}: {
  person: LivePersonnel;
  onView: (person: LivePersonnel) => void;
  onEdit: (person: LivePersonnel) => void;
  onDelete: (person: LivePersonnel) => void;
}) {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <Avatar tone={AVATAR_TONES[person.id % AVATAR_TONES.length]} size="sm">
            {person.initials || initialsOf(person.full_name)}
          </Avatar>
          <strong>{person.full_name}</strong>
        </div>
      </td>
      <td><code>{person.code}</code></td>
      <td>{person.phone || "—"}</td>
      <td>{person.email || "—"}</td>
      <td>
        <StatusPill tone={person.status === "active" ? "success" : person.status === "inactive" ? "danger" : "neutral"}>
          {statusLabel(person.status)}
        </StatusPill>
      </td>
      <td>
        <div className="flex gap-1">
          <Button variant="outline" size="xs" onClick={() => onView(person)}>Xem</Button>
          <Button variant="outline" size="xs" onClick={() => onEdit(person)}>Sửa</Button>
          <Button variant="destructive" size="xs" onClick={() => onDelete(person)}>Xóa</Button>
        </div>
      </td>
    </tr>
  );
}

function AddPersonnelModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0].label);
  const [names, setNames] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lines = names.split("\n").map((line) => line.trim()).filter(Boolean);

  const save = async () => {
    if (lines.length === 0) {
      setError("Nhập ít nhất một họ tên, mỗi dòng một người.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createLivePersonnel({ department, names: lines, phone: lines.length === 1 ? phone : undefined });
      setNames("");
      setPhone("");
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thêm được nhân sự.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm nhân sự"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
        <Field label="Phòng ban">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
            {DEPARTMENTS.map((d) => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Họ tên">
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={6}
            placeholder={"Mỗi dòng một người\nNguyễn Văn A\nTrần Thị B"}
            className={inputClass}
          />
        </Field>
        {lines.length <= 1 && (
          <Field label="Điện thoại">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function EditPersonnelModal({
  person,
  onClose,
  onSaved,
}: {
  person: LivePersonnel | null;
  onClose: () => void;
  onSaved: (person: LivePersonnel) => void;
}) {
  const [form, setForm] = useState<PersonnelForm>(() => person ? formFromPerson(person) : formFromPerson({
    id: 0, code: "", full_name: "", role: "recruiter", initials: null, email: null, phone: null, status: "active",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!person) return;
    if (!form.full_name.trim()) {
      setError("Nhập họ tên.");
      return;
    }
    setSaving(true);
    setError("");
    const body: PersonnelWrite = {
      full_name: form.full_name.trim(),
      department: form.department,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      status: form.status,
    };
    try {
      const updated = await updateLivePersonnel(person.id, body);
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được nhân sự.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={person !== null}
      onClose={onClose}
      title={person ? `Sửa ${person.code}` : "Sửa nhân sự"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
        <Field label="Họ tên">
          <input value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Phòng ban">
          <select value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} className={inputClass}>
            {DEPARTMENTS.map((d) => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Điện thoại">
          <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Trạng thái">
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className={inputClass}>
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngừng</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function PersonnelDetailModal({
  person,
  onClose,
  onEdit,
  onDelete,
}: {
  person: LivePersonnel | null;
  onClose: () => void;
  onEdit: (person: LivePersonnel) => void;
  onDelete: (person: LivePersonnel) => void;
}) {
  return (
    <Modal
      open={person !== null}
      onClose={onClose}
      title={person ? person.full_name : "Nhân sự"}
      badge={person ? <StatusPill tone={person.status === "active" ? "success" : "danger"}>{statusLabel(person.status)}</StatusPill> : null}
      footer={
        person ? (
          <>
            <Button variant="destructive" onClick={() => onDelete(person)}>Xóa</Button>
            <Button variant="outline" onClick={onClose}>Đóng</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => onEdit(person)}>Sửa</Button>
          </>
        ) : null
      }
    >
      {person && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
          <Detail label="Mã" value={person.code} />
          <Detail label="Phòng ban" value={departmentOf(person) ?? "Chưa xếp"} />
          <Detail label="Điện thoại" value={person.phone || "—"} />
          <Detail label="Email" value={person.email || "—"} />
          <Detail label="Chức danh lưu trên DB" value={person.title || "—"} />
          <Detail label="Trạng thái" value={statusLabel(person.status)} />
        </dl>
      )}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
