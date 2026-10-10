"use client";

import { useCallback, useEffect, useState } from "react";
import NextImage from "next/image";
import { MapPin } from "lucide-react";
import { ApiError } from "@/lib/api";
import { checkInLive, checkOutLive, fetchLiveAttendances, fetchLivePersonnel } from "@/lib/live";
import type { LiveAttendance } from "@/lib/live";
import { initialsOf } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

function clock(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function tone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "valid" || status === "present") return "success";
  if (status === "late") return "warning";
  if (status === "gps_warning" || status === "invalid") return "danger";
  return "info";
}

function statusLabel(status: string): string {
  if (status === "valid" || status === "present") return "Hợp lệ";
  if (status === "late") return "Đi muộn";
  if (status === "gps_warning") return "Cảnh báo GPS";
  if (status === "invalid") return "Không hợp lệ";
  return status;
}

function sameName(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

function nowVN(date: Date): string {
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function dayVN(date: Date): string {
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
}

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tw-attendance-photos", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function savePhoto(id: number, file: Blob): Promise<void> {
  return openPhotoDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function loadPhoto(id: number): Promise<string> {
  return openPhotoDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").get(String(id));
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined;
      resolve(blob ? URL.createObjectURL(blob) : "");
    };
    req.onerror = () => reject(req.error);
  }));
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Không đọc được ảnh."));
      img.onload = () => {
        const max = 960;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Không xử lý được ảnh."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không có GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Cần quyền vị trí để chấm công.")), { enableHighAccuracy: true, timeout: 8000 });
  });
}

export function AttendanceView({ embedded = false }: { embedded?: boolean }) {
  const [rows, setRows] = useState<LiveAttendance[]>([]);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<"in" | "out" | null>(null);
  const [people, setPeople] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [personId, setPersonId] = useState("");
  const [photo, setPhoto] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const page = await fetchLiveAttendances(day || undefined);
      setRows(page.rows);
      setError("");
      const next: Record<number, string> = {};
      await Promise.all(page.rows.map(async (row) => {
        next[row.id] = await loadPhoto(row.id).catch(() => "");
      }));
      setPhotos(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được chấm công.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const openForm = async (mode: "in" | "out") => {
    setOpen(mode);
    setPhoto("");
    setFormError("");
    try {
      const staff = await fetchLivePersonnel();
      const list = staff.filter((person) => person.status === "active").map((person) => ({
        id: person.id,
        name: person.full_name,
        code: person.code,
      }));
      setPeople(list);
      setPersonId(list[0] ? String(list[0].id) : "");
      if (list.length === 0) setFormError("Chưa có nhân sự đang làm.");
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được danh sách nhân sự.");
    }
  };

  const submit = async () => {
    const person = people.find((item) => String(item.id) === personId);
    if (!person) return;
    if (!photo) {
      setFormError("Chụp ảnh trước khi chấm công.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const pos = await locate();
      const blob = await (await fetch(photo)).blob();
      if (open === "out") {
        const record = rows.find((row) => !row.check_out_at && row.worker && sameName(row.worker.full_name, person.name));
        if (!record) {
          setFormError("Người này chưa check-in nên chưa check-out được.");
          return;
        }
        const saved = await checkOutLive(record.id, { check_out_lat: pos.coords.latitude, check_out_lng: pos.coords.longitude });
        await savePhoto(saved.id, blob);
      } else {
        const saved = await checkInLive({
          staff_id: person.id,
          check_in_lat: pos.coords.latitude,
          check_in_lng: pos.coords.longitude,
        });
        await savePhoto(saved.id, blob);
      }
      setOpen(null);
      setPhoto("");
      await load(date);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Chấm công thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={embedded ? "flex min-h-0 flex-1 flex-col bg-[#f4f6fa]" : "flex h-full flex-col bg-[#f4f6fa]"}>
      <header className="border-b bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-lg flex-col items-center">
          <NextImage src="/images/logo.png" alt="Trang Way" width={1024} height={1024} priority className="h-auto w-[240px]" />
          <div className="mt-1 text-[40px] font-bold leading-none tabular-nums tracking-tight text-[#0b4c8f]">{nowVN(now)}</div>
          <div className="mt-1 text-[13px] capitalize text-slate-500">{dayVN(now)}</div>
        </div>
        <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-2">
          <button type="button" onClick={() => void openForm("in")} className="rounded-2xl bg-[#0052cc] px-3 py-3 text-white">
            <div className="text-[13px] font-semibold">Check-in</div>
            <div className="text-[18px] font-bold tabular-nums">{nowVN(now)}</div>
          </button>
          <button type="button" onClick={() => void openForm("out")} className="rounded-2xl bg-slate-800 px-3 py-3 text-white">
            <div className="text-[13px] font-semibold">Check-out</div>
            <div className="text-[18px] font-bold tabular-nums">{nowVN(now)}</div>
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-lg justify-end">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]" />
        </div>
      </header>
      <QueryState loading={loading} error={error}>
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {rows.length === 0 && <p className="py-10 text-center text-[13px] text-slate-400">Không có bản ghi chấm công</p>}
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            {rows.map((a) => (
              <article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  {photos[a.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[a.id]} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <Avatar tone="avatar-blue" size="sm">{initialsOf(a.worker?.full_name ?? "?")}</Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold text-slate-900">{a.worker?.full_name ?? "—"}</div>
                    <div className="truncate text-[12px] text-slate-500">{a.worker?.code} · {a.site?.name ?? "Chưa có địa điểm"}</div>
                  </div>
                  <StatusPill tone={tone(a.status)}>{statusLabel(a.status)}</StatusPill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 px-2 py-3">
                    <div className="text-[12px] font-semibold text-emerald-700">Giờ check-in</div>
                    <div className="text-[22px] font-bold tabular-nums text-emerald-800">{clock(a.check_in_at)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-2 py-3">
                    <div className="text-[12px] font-semibold text-slate-500">Giờ check-out</div>
                    <div className="text-[22px] font-bold tabular-nums text-slate-800">{clock(a.check_out_at)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[12px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{a.shift?.name ?? "Ca"} · {a.check_in_distance_m ?? "—"}m · Công {a.work_units ?? "—"}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </QueryState>
      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === "out" ? "Check-out" : "Check-in"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>Hủy</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void submit()}>{busy ? "Đang ghi..." : "Ghi nhận"}</Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="mb-3 text-center text-[28px] font-bold tabular-nums text-[#0b4c8f]">{nowVN(now)}</div>
        <Field label="Nhân sự đang làm">
          <select className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {people.map((person) => <option key={person.id} value={person.id}>{person.code} - {person.name}</option>)}
          </select>
        </Field>
        <div className="mt-3">
          <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh chấm công *</span>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="mb-2 h-40 w-full rounded-xl object-cover" />
          )}
          <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#0052cc] text-[14px] font-semibold text-[#0052cc]">
            {photo ? "Chụp lại" : "Chụp ảnh"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void readPhoto(file).then(setPhoto).catch(() => setFormError("Không chụp được ảnh."));
              }}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
