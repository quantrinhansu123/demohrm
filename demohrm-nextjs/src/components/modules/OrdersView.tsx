"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { fetchLiveOrders, fetchLivePositions, toOrderSummary } from "@/lib/live";
import type { OrderSummary } from "@/types/hrm";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { JobDescriptionView } from "@/components/modules/JobDescriptionView";
import { LinkedVideo, playableVideo } from "@/components/modules/LinkedVideo";
import { StatusPill } from "@/components/ui/badge";
import { Field, Modal } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { ApiError, apiPatch } from "@/lib/api";

const legendTone: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-400",
  orange: "bg-amber-500",
  grey: "bg-slate-300",
};

const WAGE_SLOTS = [
  { label: "Ca ngày", pay: "350.000", tone: "bg-sky-50 text-sky-900" },
  { label: "Ca đêm", pay: "425.000", tone: "bg-sky-50 text-sky-900" },
  { label: "CN ngày", pay: "560.000", tone: "bg-amber-50 text-amber-950" },
  { label: "CN đêm", pay: "600.000", tone: "bg-amber-50 text-amber-950" },
];

const DRAFT_KEY = "tw-order-card-drafts";

interface OrderDraft {
  title: string;
  summary: string;
  manager: string;
  target: number;
  videoLink: string;
  wages: string[];
  images: string[];
  videoStamp?: number;
}

function defaultDraft(order: OrderSummary): OrderDraft {
  return {
    title: order.title,
    summary: "",
    manager: order.manager,
    target: order.target,
    videoLink: "",
    wages: WAGE_SLOTS.map((slot) => slot.pay),
    images: [],
  };
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tw-order-media", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveOrderVideo(code: string, file: Blob): Promise<void> {
  return openMediaDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, `${code}:video`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function loadOrderVideo(code: string): Promise<string> {
  return openMediaDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").get(`${code}:video`);
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined;
      resolve(blob ? URL.createObjectURL(blob) : "");
    };
    req.onerror = () => reject(req.error);
  }));
}

function fileToImageDataUrl(file: File): Promise<string> {
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

function loadDrafts(): Record<string, OrderDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OrderDraft>) : {};
  } catch {
    return {};
  }
}

export function OrdersView() {
  const { periodCode, periods } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrderSummary | null>(null);
  const [selectedTab, setSelectedTab] = useState<"desc" | "workers">("desc");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [editing, setEditing] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? periodCode;
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    Promise.all([fetchLiveOrders(periodCode), fetchLivePositions()])
      .then(([rows, positions]) => {
        if (alive) {
          setOrders(rows.map((r) => toOrderSummary(r, positions)));
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được đơn hàng.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  const visible = useMemo(
    () => orders.filter((o) => o.title.toLowerCase().includes(query.toLowerCase().trim()) || o.code.toLowerCase().includes(query.toLowerCase().trim())),
    [query, orders]
  );

  const openOrder = (order: OrderSummary, tab: "desc" | "workers" = "desc") => {
    setSelectedTab(tab);
    setSelected(order);
  };

  if (selected) {
    return (
      <JobDescriptionView
        order={selected}
        initialTab={selectedTab}
        videoUrl={drafts[selected.code]?.videoLink ?? ""}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Nhu cầu tuyển đang mở"
        sub={`Thẻ đơn hàng mới: thông tin công việc và lương hiện ngay trên thẻ, không cần mở chi tiết. · ${periodName}`}
        actions={
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm đơn hàng..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#2563eb] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo đơn hàng
            </button>
          </>
        }
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body flex flex-col gap-3 bg-[#f4f6f9]">
          {visible.map((o) => (
            <OrderDemandCard
              key={o.code}
              order={o}
              draft={drafts[o.code]}
              onOpen={openOrder}
              onEdit={() => setEditing(o)}
            />
          ))}
          {visible.length === 0 && <p className="py-10 text-center text-slate-400">Không có đơn hàng trong kỳ này.</p>}
        </div>
      </QueryState>
      <OrderEditModal
        order={editing}
        draft={editing ? drafts[editing.code] ?? defaultDraft(editing) : null}
        onClose={() => setEditing(null)}
        onSave={(order, draft) => {
          const next = { ...drafts, [order.code]: draft };
          setDrafts(next);
          localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
          setOrders((rows) => rows.map((row) => (
            row.code === order.code ? { ...row, title: draft.title, manager: draft.manager, target: draft.target } : row
          )));
        }}
      />
    </section>
  );
}

function OrderDemandCard({
  order,
  draft,
  onOpen,
  onEdit,
}: {
  order: OrderSummary;
  draft?: OrderDraft;
  onOpen: (order: OrderSummary, tab?: "desc" | "workers") => void;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fileVideo, setFileVideo] = useState("");
  const images = draft?.images ?? [];
  const title = draft?.title || order.title;
  const manager = draft?.manager || order.manager;
  const target = draft?.target ?? order.target;
  const wages = WAGE_SLOTS.map((slot, i) => ({ ...slot, pay: draft?.wages[i] || slot.pay }));
  const preview = order.status === "Đang chạy" && target > 0;
  const filled = preview ? 9 : 5;
  const totalChecks = 16;
  const linkedVideo = draft?.videoLink && playableVideo(draft.videoLink) ? draft.videoLink : "";
  const videoLink = linkedVideo || fileVideo;

  useEffect(() => {
    let alive = true;
    let created = "";
    void loadOrderVideo(order.code)
      .then((href) => {
        if (!alive) {
          if (href) URL.revokeObjectURL(href);
          return;
        }
        created = href;
        setFileVideo(href);
      })
      .catch(() => setFileVideo(""));
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [order.code, draft?.videoStamp]);
  const shareText = [
    title,
    draft?.summary,
    `${order.code} · ${order.period}`,
    `Tuyển ${target} người · Đã đi làm ${order.working}/${target}`,
    `Phụ trách: ${manager}`,
    preview
      ? wages.map((slot) => `${slot.label}: ${slot.pay} đ`).join("\n") + "\nLương / công · trả theo tuần"
      : "Thiếu: ảnh nơi làm việc, bảng lương theo ca, ca làm, điểm tập trung",
    "",
    videoLink ? `Link video: ${videoLink}` : "Link video: Chưa có video",
  ].filter(Boolean).join("\n");

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-[176px]">
          <PreviewMedia src={videoLink} images={images} onCopy={() => void copyShare()} copied={copied} onAdd={onEdit} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={order.status === "Đang chạy" ? "success" : "neutral"}>{order.status}</StatusPill>
              <StatusPill tone="neutral">Thời vụ</StatusPill>
              {preview && <span className="text-[12px] font-semibold text-rose-600">3 thông tin chưa khớp</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] bg-white px-2.5 py-1 text-[12.5px] font-semibold text-[#1d4ed8] hover:bg-blue-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Sửa
              </button>
              <button type="button" className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" aria-label="Thêm thao tác">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
          <h2 className="mt-1.5 text-[16px] font-bold leading-tight text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            {draft?.summary ? `${draft.summary} · ` : ""}{order.code} · {order.period} · Phụ trách {manager}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[`${target} người`, `${order.positions} vị trí`, `${order.vendors} vendor`, "Ca ngày · Ca đêm"].map((chip) => (
              <span key={chip} className="rounded-md bg-slate-100 px-2 py-1 text-[12px] font-medium text-slate-600">
                {chip}
              </span>
            ))}
          </div>

          {preview ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {wages.map((slot) => (
                  <div key={slot.label} className={`rounded-lg px-2 py-1.5 ${slot.tone}`}>
                    <div className="text-[11px] font-medium opacity-70">{slot.label}</div>
                    <div className="text-[14px] font-bold leading-tight">{slot.pay} <span className="text-[11px] font-semibold">đ</span></div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11.5px] text-slate-400">Lương / công · trả theo tuần</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] font-medium text-rose-600">
              Thiếu: ảnh nơi làm việc, bảng lương theo ca, ca làm, điểm tập trung
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(order, "desc")}
              className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Xem mô tả đầy đủ
            </button>
            <button
              type="button"
              onClick={() => void copyShare()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Đã sao chép" : "Sao chép nội dung + link video"}
            </button>
            <button
              type="button"
              onClick={() => onOpen(order, "workers")}
              className="px-2 py-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-900"
            >
              Danh sách công nhân ({order.totalProfiles})
            </button>
          </div>
        </div>

        <aside className="w-full shrink-0 border-slate-100 xl:w-[210px] xl:border-l xl:pl-4">
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold text-slate-700">Tiến độ giao người</span>
            <span className="font-bold text-slate-900">{order.working}/{target}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {order.funnel.map((f) => (
              <div key={f.label} className="flex items-center justify-between text-[12.5px] text-slate-600">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${legendTone[f.tone]}`} />
                  {f.label}
                </span>
                <span className="font-semibold text-slate-800">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[12.5px]">
            <span className="font-medium text-slate-600">Thông tin đã đủ</span>
            <span className={`font-bold ${preview ? "text-orange-500" : "text-rose-500"}`}>{filled}/{totalChecks}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${preview ? "bg-orange-400" : "bg-rose-300"}`}
              style={{ width: `${(filled / totalChecks) * 100}%` }}
            />
          </div>
        </aside>
      </div>
    </article>
  );
}

function PreviewMedia({
  src,
  images,
  onCopy,
  copied,
  onAdd,
}: {
  src: string;
  images: string[];
  onCopy: () => void;
  copied: boolean;
  onAdd: () => void;
}) {
  return (
    <div>
      <div className="relative h-[150px] overflow-hidden rounded-lg bg-slate-900">
        {src ? (
          <LinkedVideo src={src} label="Phát từ link" className="absolute inset-0 h-full w-full" />
        ) : (
          <button type="button" onClick={onAdd} className="absolute inset-0 grid place-items-center px-2 text-center text-[12px] font-medium text-slate-300">
            + Thêm video
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 shadow"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Đã chép" : "Copy"}
        </button>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {(images.length > 0 ? images.slice(0, 4) : [0, 1, 2, 3]).map((item, i) => (
          <div key={i} className="relative h-8 overflow-hidden rounded bg-slate-200">
            {typeof item === "string" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item} alt="" className="h-full w-full object-cover" />
            ) : (
              <ThumbScene className="absolute inset-0 h-full w-full" hue={item} />
            )}
            {images.length > 4 && i === 3 && (
              <span className="absolute inset-0 grid place-items-center bg-black/45 text-[11px] font-bold text-white">+{images.length - 3}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderEditModal({
  order,
  draft,
  onClose,
  onSave,
}: {
  order: OrderSummary | null;
  draft: OrderDraft | null;
  onClose: () => void;
  onSave: (order: OrderSummary, draft: OrderDraft) => void;
}) {
  const [form, setForm] = useState<OrderDraft | null>(draft);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [prevOrder, setPrevOrder] = useState(order?.code ?? "");
  if ((order?.code ?? "") !== prevOrder) {
    setPrevOrder(order?.code ?? "");
    setForm(draft ? { ...draft, images: draft.images ?? [] } : draft);
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview("");
    setSaveError("");
  }

  const set = (patch: Partial<OrderDraft>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const submit = async () => {
    if (!order || !form) return;
    setSaving(true);
    setSaveError("");
    const saved = { ...form, target: Number(form.target) || 0, images: form.images ?? [] };
    try {
      if (videoFile) {
        await saveOrderVideo(order.code, videoFile);
        saved.videoStamp = Date.now();
      }
      if (order.orderId) {
        const name = form.title.includes("–") ? form.title.split("–").slice(1).join("–").trim() : form.title;
        await apiPatch(`/orders/${order.orderId}`, {
          name: name || form.title,
          target_qty: saved.target,
          note: form.summary,
        });
      }
    } catch (e: unknown) {
      onSave(order, saved);
      setSaveError(e instanceof ApiError ? e.message : "Máy chủ chưa nhận bản sửa. Thông tin vẫn được cập nhật trên thẻ.");
      setSaving(false);
      return;
    }
    onSave(order, saved);
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      open={order !== null && form !== null}
      onClose={onClose}
      title={order ? `Sửa thông tin ${order.code}` : "Sửa thông tin"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700">
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu thông tin"}
          </button>
        </>
      }
    >
      {form && (
        <div className="grid gap-3 sm:grid-cols-2">
          {saveError && <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{saveError}</p>}
          <div className="sm:col-span-2">
            <Field label="Tên đơn hàng">
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Mô tả ngắn">
              <textarea value={form.summary} onChange={(e) => set({ summary: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Link video">
              <input value={form.videoLink} onChange={(e) => set({ videoLink: e.target.value })} placeholder="https://youtube.com/... hoặc link Facebook, file video" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]" />
            </Field>
          </div>
          <Field label="Phụ trách">
            <input value={form.manager} onChange={(e) => set({ manager: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]" />
          </Field>
          <Field label="Chỉ tiêu (người)">
            <input value={form.target} onChange={(e) => set({ target: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]" />
          </Field>
          {WAGE_SLOTS.map((slot, i) => (
            <Field key={slot.label} label={`Lương ${slot.label}`}>
              <input
                value={form.wages[i] ?? ""}
                onChange={(e) => {
                  const wages = [...form.wages];
                  wages[i] = e.target.value;
                  set({ wages });
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]"
              />
            </Field>
          ))}
          <div className="sm:col-span-2">
            <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh nơi làm việc</span>
            <div className="flex flex-wrap items-center gap-2">
              {(form.images ?? []).map((src, i) => (
                <div key={`${i}-${src.slice(0, 24)}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => set({ images: form.images.filter((_, j) => j !== i) })}
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[12px] text-white"
                    aria-label="Xóa ảnh"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 text-[12px] font-semibold text-[#1d4ed8]">
                + Thêm ảnh
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    void Promise.all(files.map((file) => fileToImageDataUrl(file))).then((urls) => {
                      setForm((prev) => prev ? { ...prev, images: [...(prev.images ?? []), ...urls] } : prev);
                    }).catch(() => setSaveError("Không thêm được ảnh."));
                  }}
                />
              </label>
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Video nơi làm việc</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[12.5px] font-semibold text-[#1d4ed8]">
                + Thêm video
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (videoPreview) URL.revokeObjectURL(videoPreview);
                    setVideoFile(file);
                    setVideoPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              {videoFile && <span className="text-[12.5px] text-slate-500">{videoFile.name}</span>}
            </div>
            {videoPreview && <video src={videoPreview} controls className="mt-2 h-32 w-full rounded-lg bg-black" />}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ThumbScene({ className, hue = 0 }: { className?: string; hue?: number }) {
  const sky = ["#7dd3fc", "#93c5fd", "#67e8f9", "#fbbf24"][hue % 4];
  return (
    <svg viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width="160" height="96" fill="#1e293b" />
      <rect x="8" y="28" width="36" height="52" fill="#334155" />
      <rect x="50" y="16" width="58" height="64" fill="#1e3a5f" />
      <rect x="116" y="34" width="34" height="46" fill="#334155" />
      <rect x="58" y="24" width="42" height="8" fill={sky} />
      <rect y="78" width="160" height="18" fill="#0f172a" />
    </svg>
  );
}
