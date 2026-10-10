"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { ApiError } from "@/lib/api";
import { DEPARTMENTS, departmentOf, positionOf } from "@/lib/departments";
import { initialsOf } from "@/lib/format";
import { createLivePersonnel, deleteLivePersonnel, fetchLivePersonnel, updateLivePersonnel } from "@/lib/live";
import type { LivePersonnel, PersonnelWrite } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
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

function showDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

interface PersonnelForm {
  full_name: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  date_of_birth: string;
  hired_on: string;
  status: string;
}

function formFromPerson(person: LivePersonnel): PersonnelForm {
  return {
    full_name: person.full_name,
    department: departmentOf(person) ?? DEPARTMENTS[0].label,
    position: positionOf(person),
    phone: person.phone ?? "",
    email: person.email ?? "",
    date_of_birth: person.date_of_birth?.slice(0, 10) ?? "",
    hired_on: person.hired_on?.slice(0, 10) ?? "",
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
  const [dropDepartment, setDropDepartment] = useState<string | null>(null);

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
      [r.full_name, r.code, r.email, r.phone, departmentOf(r), positionOf(r), r.date_of_birth, r.hired_on]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [query, rows]);

  const active = rows.filter((r) => r.status === "active").length;
  const columns = useMemo(() => {
    const groups = new Map<string, LivePersonnel[]>(DEPARTMENTS.map((item) => [item.label, []]));
    const unmatched: LivePersonnel[] = [];
    for (const person of filtered) {
      const department = departmentOf(person);
      const bucket = department ? groups.get(department) : undefined;
      if (bucket) bucket.push(person);
      else unmatched.push(person);
    }
    const board: { label: string; people: LivePersonnel[] }[] = DEPARTMENTS.map((item) => ({ label: item.label, people: groups.get(item.label) ?? [] }));
    if (unmatched.length > 0) board.push({ label: "Chưa phân phòng", people: unmatched });
    if (!query.trim()) return board;
    return board.filter((column) => column.people.length > 0);
  }, [filtered, query]);

  const movePerson = async (person: LivePersonnel, department: string) => {
    if (!DEPARTMENTS.some((item) => item.label === department) || departmentOf(person) === department) return;
    try {
      const updated = await updateLivePersonnel(person.id, {
        full_name: person.full_name,
        department,
        position: positionOf(person) || null,
        phone: person.phone,
        email: person.email,
        date_of_birth: person.date_of_birth,
        hired_on: person.hired_on,
        status: person.status === "inactive" ? "inactive" : "active",
      });
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      if (viewing?.id === updated.id) setViewing(updated);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Không chuyển được phòng ban.");
    }
  };

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
              <button type="button" onClick={() => setPane("people")} className={pane === "people" ? "rounded-md bg-white px-3 py-1 text-[#0052cc] shadow-sm" : "px-3 py-1 text-slate-500"}>Kanban</button>
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
            <KpiCard title="PHÒNG BAN" value={<>{new Set(rows.map((r) => departmentOf(r)).filter(Boolean)).size}</>} sub="Theo người đang có trong danh sách" />
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {columns.map((column) => (
              <section
                key={column.label}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropDepartment(column.label);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setDropDepartment((current) => (current === column.label ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropDepartment(null);
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  const person = rows.find((row) => row.id === id);
                  if (person) void movePerson(person, column.label);
                }}
                className={`flex w-72 shrink-0 flex-col rounded-xl border bg-[#eef2f7] ${dropDepartment === column.label ? "border-[#0052cc]" : "border-transparent"}`}
              >
                <header className="flex items-center justify-between px-3 py-2.5">
                  <h2 className="text-[13px] font-bold text-slate-800">{column.label}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-500">{column.people.length}</span>
                </header>
                <div className="flex min-h-36 flex-col gap-2 px-2 pb-2">
                  {column.people.map((person) => (
                    <PersonnelCard key={person.id} person={person} onView={setViewing} onEdit={setEditing} onDelete={handleDelete} />
                  ))}
                  {column.people.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-slate-400">Chưa có người</p>}
                </div>
              </section>
            ))}
            {columns.length === 0 && <p className="py-10 text-[13px] text-slate-400">Không có nhân sự khớp từ khóa.</p>}
          </div>
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

function PersonnelCard({
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
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 112 });
    setOpen((value) => !value);
  };

  const position = positionOf(person);
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(person.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <Avatar tone={AVATAR_TONES[person.id % AVATAR_TONES.length]} size="sm">
          {person.initials || initialsOf(person.full_name)}
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-slate-900">{person.full_name}</div>
          <div className="text-[12px] text-slate-500">{person.code}{position ? ` · ${position}` : ""}</div>
        </div>
        <button
          ref={buttonRef}
          type="button"
          draggable={false}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={toggle}
          className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
          aria-label="Thao tác nhân sự"
          aria-expanded={open}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 space-y-0.5 text-[12px] text-slate-600">
        <div>{person.phone || "Chưa có điện thoại"}</div>
        <div>Sinh {showDate(person.date_of_birth)} · Vào làm {showDate(person.hired_on)}</div>
      </div>
      {person.status !== "active" && <div className="mt-2"><StatusPill tone="neutral">{statusLabel(person.status)}</StatusPill></div>}
      {open && (
        <div ref={menuRef} className="fixed z-50 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ top: menuPos.top, left: menuPos.left }}>
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onView(person); }}>Xem</button>
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onEdit(person); }}>Sửa</button>
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { setOpen(false); onDelete(person); }}>Xóa</button>
        </div>
      )}
    </article>
  );
}

function AddPersonnelModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0].label);
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [hiredOn, setHiredOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!fullName.trim()) {
      setError("Nhập họ tên.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createLivePersonnel({
        full_name: fullName.trim(),
        department,
        position: position.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        date_of_birth: dateOfBirth || null,
        hired_on: hiredOn || null,
      });
      setFullName("");
      setPosition("");
      setPhone("");
      setEmail("");
      setDateOfBirth("");
      setHiredOn("");
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
        <Field label="Họ tên">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Nguyễn Văn A" />
        </Field>
        <Field label="Phòng ban">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
            {DEPARTMENTS.map((d) => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Vị trí">
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} placeholder="Ví dụ: Nhân viên tuyển dụng" />
        </Field>
        <Field label="Ngày sinh">
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Ngày vào làm">
          <input type="date" value={hiredOn} onChange={(e) => setHiredOn(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Điện thoại">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
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
    date_of_birth: null, hired_on: null,
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
      position: form.position.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      date_of_birth: form.date_of_birth || null,
      hired_on: form.hired_on || null,
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
        <Field label="Vị trí">
          <input value={form.position} onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))} className={inputClass} placeholder="Ví dụ: Nhân viên tuyển dụng" />
        </Field>
        <Field label="Điện thoại">
          <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Ngày sinh">
          <input type="date" value={form.date_of_birth} onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Ngày vào làm">
          <input type="date" value={form.hired_on} onChange={(e) => setForm((prev) => ({ ...prev, hired_on: e.target.value }))} className={inputClass} />
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
          <Detail label="Vị trí" value={positionOf(person) || "—"} />
          <Detail label="Ngày sinh" value={showDate(person.date_of_birth)} />
          <Detail label="Ngày vào làm" value={showDate(person.hired_on)} />
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
