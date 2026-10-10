"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Circle,
  Copy,
  ImagePlus,
  MapPin,
} from "lucide-react";
import { LinkedVideo, playableVideo } from "@/components/modules/LinkedVideo";
import type { OrderSummary } from "@/types/hrm";

const CHECKS: { label: string; done: boolean; blocks?: boolean }[] = [
  { label: "Ảnh nơi làm việc", done: true },
  { label: "Video nơi làm việc", done: true },
  { label: "Địa chỉ", done: true },
  { label: "Công việc", done: true },
  { label: "Mô tả công việc", done: true },
  { label: "Ca làm", done: true },
  { label: "Mức lương đã chốt", done: true },
  { label: "Phúc lợi", done: true },
  { label: "Yêu cầu hồ sơ", done: true },
  { label: "Giờ làm việc", done: false, blocks: true },
  { label: "Giấy tờ cần mang", done: false, blocks: true },
  { label: "Đồ dùng cá nhân", done: false, blocks: true },
  { label: "Đóng lương & thưởng", done: false },
  { label: "Thời gian tăng ca", done: false },
  { label: "Tổng phụ cấp", done: false },
  { label: "Hỗ trợ theo ca đêm", done: false },
];

const SHIFTS: { name: string; time: string; pay: string; allowance: string; tone: string }[] = [
  { name: "Ca đêm", time: "12–17", pay: "350.000", allowance: "20.000", tone: "bg-sky-50 border-sky-100" },
  { name: "Ca đêm", time: "17–22", pay: "425.000", allowance: "20.000", tone: "bg-amber-50 border-amber-100" },
  { name: "Ca ngày", time: "07–17", pay: "560.000", allowance: "20.000", tone: "bg-emerald-50 border-emerald-100" },
  { name: "Ca ngày đêm", time: "Xoay ca", pay: "600.000", allowance: "20.000", tone: "bg-violet-50 border-violet-100" },
];

const THUMBS = ["Dây chuyền", "Đóng gói", "Kho linh kiện", "Cổng nhà máy"];

export function JobDescriptionView({
  order,
  onBack,
  initialTab = "desc",
  videoUrl = "",
}: {
  order: OrderSummary;
  onBack: () => void;
  initialTab?: "desc" | "workers";
  videoUrl?: string;
}) {
  const [tab, setTab] = useState<"desc" | "workers">(initialTab);
  const [copied, setCopied] = useState(false);
  const doneCount = CHECKS.filter((c) => c.done).length;
  const blockers = CHECKS.filter((c) => c.blocks && !c.done);
  const missing = Math.max(0, order.target - order.working);
  const company = order.title.split("–")[0]?.trim() || order.title;
  const site = order.title.includes("–") ? order.title.split("–").slice(1).join("–").trim() : order.title;

  const zaloText = useMemo(
    () =>
      [
        `${order.title}`,
        `Tuyển ${order.target} công nhân. Đã có ${order.working} người đi làm, còn thiếu ${missing}.`,
        `Ca làm: ca đêm 12–17 (350.000đ), ca đêm 17–22 (425.000đ), ca ngày 07–17 (560.000đ), ca ngày đêm (600.000đ). Phụ cấp 20.000đ/ca.`,
        `Việc làm: sản xuất dây điện, đóng gói, kiểm tra. Có chỗ ở, xe đưa đón.`,
        `Thời gian: ${order.period}. Phụ trách: ${order.manager}.`,
        `Liên hệ Trang Way để nhận việc.`,
        videoUrl && playableVideo(videoUrl) ? `Link video: ${videoUrl}` : "Link video: chưa có",
      ].join("\n"),
    [missing, order.manager, order.period, order.target, order.title, order.working, videoUrl]
  );

  const copyZalo = async () => {
    try {
      await navigator.clipboard.writeText(zaloText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="flex h-full flex-col bg-[#f4f6f9]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-3">
        <div className="min-w-0 text-[13px] text-slate-500">
          <button type="button" onClick={onBack} className="hover:text-[#1d4ed8]">
            Đơn hàng cung ứng
          </button>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="font-medium text-slate-700">{order.code}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={blockers.length > 0}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Sẵn sàng đăng
          </button>
          <button
            type="button"
            onClick={() => void copyZalo()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Đã sao chép" : "Sao chép nội dung + link video"}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4">
          <div className="text-[12px] font-medium text-slate-400">Đang tuyển · {order.code}</div>
          <h1 className="mt-0.5 text-[26px] font-bold tracking-tight text-slate-900">{order.title}</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Sản xuất dây điện, đóng gói và kiểm tra · {order.period} · Phụ trách {order.manager}
          </p>
        </div>

        <div className="mb-4 flex gap-6 border-b border-slate-200">
          {(
            [
              ["desc", "Mô tả công việc"],
              ["workers", `Công nhân (${order.totalProfiles})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 pb-2.5 text-[13px] font-bold tracking-wide ${
                tab === id ? "border-[#2563eb] text-[#1d4ed8]" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "workers" ? (
          <WorkersPane order={order} />
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex flex-col gap-4">
              {blockers.length > 0 && (
                <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] text-orange-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <div>
                    <div className="font-semibold">{blockers.length} thông tin chưa đủ — cần bổ sung trước khi đăng tin</div>
                    <div className="mt-0.5 text-orange-800/90">{blockers.map((b) => b.label).join(" · ")}</div>
                  </div>
                </div>
              )}

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-slate-900">Hình ảnh & video nơi làm việc</h2>
                  <span className="text-[12px] text-slate-400">1 video · {THUMBS.length} ảnh</span>
                </div>
                <div className="relative h-[280px] overflow-hidden rounded-xl bg-slate-900">
                  {playableVideo(videoUrl) ? (
                    <LinkedVideo src={videoUrl} label="Video nơi làm việc" className="absolute inset-0 h-full w-full" />
                  ) : (
                    <FactoryScene />
                  )}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {THUMBS.map((name, i) => (
                    <div
                      key={name}
                      className={`overflow-hidden rounded-lg border ${i === 0 ? "border-[#2563eb] ring-2 ring-blue-200" : "border-slate-200"}`}
                    >
                      <FactoryScene compact hue={i} />
                      <div className="truncate bg-white px-2 py-1 text-[11px] text-slate-500">{name}</div>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-600">
                  <ImagePlus className="h-4 w-4" />
                  Thêm ảnh / video nơi làm việc
                </button>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-[14px] font-bold text-slate-900">Thông tin nhanh</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Doanh nghiệp", company],
                    ["Địa điểm", site],
                    ["Đã đi làm", `${order.working} người`],
                    ["Còn thiếu", `${missing} người`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="text-[11.5px] text-slate-500">{k}</div>
                      <div className="mt-1 text-[15px] font-bold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-slate-900">Ca làm & lương</h2>
                  <span className="text-[12px] text-slate-400">Đã chốt theo ca · còn hiệu lực</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {SHIFTS.map((s) => (
                    <div key={`${s.name}-${s.time}`} className={`rounded-xl border px-3 py-3 ${s.tone}`}>
                      <div className="text-[12px] font-semibold text-slate-600">
                        {s.name} <span className="font-medium text-slate-400">{s.time}</span>
                      </div>
                      <div className="mt-1 text-[22px] font-bold leading-none text-slate-900">
                        {s.pay} <span className="text-[14px] font-semibold">đ</span>
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500">Phụ cấp {s.allowance} đ</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12.5px] text-slate-500">
                  Việc làm thêm tính theo ngày · Lương tháng khoảng <strong className="text-slate-700">2.660.000 đ</strong>
                  {" · "}4 ca · 350.000–600.000 · tuyển {order.target} người
                </p>
              </article>

              <div className="grid gap-4 lg:grid-cols-2">
                <InfoCard
                  title="Công việc & môi trường"
                  items={[
                    "Sản xuất dây điện, đấu nối, đóng gói",
                    "Phân loại linh kiện, dán tem",
                    "Làm theo ca 8–12 tiếng, nghỉ giữa ca",
                    "Nhà máy mát, có bảo hộ và chỗ ngồi",
                  ]}
                />
                <InfoCard
                  title="Yêu cầu & hồ sơ"
                  items={[
                    "Nam/nữ 18–45 tuổi, sức khỏe tốt",
                    "Không yêu cầu kinh nghiệm",
                    "CMND/CCCD còn hạn",
                    "Chấp nhận người mới — chưa có sổ",
                  ]}
                />
                <InfoCard
                  title="Phúc lợi"
                  items={["Ăn ca — chưa có", "Chỗ ở / xe đưa đón — chưa có", "Bảo hiểm, khám sức khỏe — chưa có"]}
                  muted
                />
                <InfoCard
                  title="Địa điểm & nhận việc"
                  items={[
                    `${site || company} · KCN Bình Xuân`,
                    "Điểm tập trung, giờ có mặt — chưa có",
                    "Người nhận việc tại cổng — chưa có",
                  ]}
                />
              </div>
            </div>

            <aside className="flex flex-col gap-4 xl:sticky xl:top-0">
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-slate-900">Đủ dữ liệu thông tin</h2>
                  <span className="text-[13px] font-bold text-orange-500">
                    {doneCount}/{CHECKS.length}
                  </span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${(doneCount / CHECKS.length) * 100}%` }} />
                </div>
                <ul className="flex flex-col gap-1.5">
                  {CHECKS.map((c) => (
                    <li key={c.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex items-center gap-2 text-slate-700">
                        {c.done ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-orange-400" />
                        )}
                        {c.label}
                      </span>
                      <span className={c.done ? "text-emerald-600" : "text-orange-500"}>{c.done ? "Đủ" : "Thiếu"}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-slate-900">Tin nhắn gửi ứng viên</h2>
                  <span className="text-[11px] text-slate-400">Bản nháp</span>
                </div>
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-slate-600">{zaloText}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyZalo()}
                    className="rounded-lg border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Đọc mẫu tin nhắn
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Tải ảnh + video
                  </button>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-slate-900">Tiến độ giao người</h2>
                  <span className="text-[13px] font-bold text-slate-700">
                    {order.working}/{order.target}
                  </span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#2563eb]"
                    style={{ width: `${order.target > 0 ? Math.min(100, Math.round((order.working / order.target) * 100)) : 0}%` }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  {order.funnel.map((f) => (
                    <div key={f.label} className="flex items-center justify-between text-[12.5px] text-slate-600">
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            f.tone === "green" ? "bg-emerald-500" : f.tone === "blue" ? "bg-sky-400" : f.tone === "orange" ? "bg-amber-500" : "bg-slate-300"
                          }`}
                        />
                        {f.label}
                      </span>
                      <strong className="text-slate-800">{f.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoCard({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
        {title === "Địa điểm & nhận việc" && <MapPin className="h-4 w-4 text-[#2563eb]" />}
        {title}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className={`text-[13px] leading-snug ${muted || item.includes("chưa có") ? "text-slate-400" : "text-slate-700"}`}>
            · {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function WorkersPane({ order }: { order: OrderSummary }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-[15px] font-bold text-slate-900">Công nhân thuộc nhu cầu {order.code}</h2>
      <p className="mt-1 text-[13px] text-slate-500">
        {order.totalProfiles} hồ sơ · {order.working} đã đi làm · phụ trách {order.manager}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {order.funnel.map((f) => (
          <div key={f.label} className="rounded-xl bg-slate-50 px-3 py-3">
            <div className="text-[12px] text-slate-500">{f.label}</div>
            <div className="mt-1 text-[20px] font-bold text-slate-900">{f.value}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function FactoryScene({ compact, hue = 0 }: { compact?: boolean; hue?: number }) {
  const sky = ["#7dd3fc", "#93c5fd", "#67e8f9", "#a5b4fc"][hue % 4];
  return (
    <svg viewBox="0 0 640 280" className={compact ? "h-16 w-full" : "h-[280px] w-full"} aria-hidden>
      <rect width="640" height="280" fill="#0f172a" />
      <rect y="150" width="640" height="130" fill="#1e293b" />
      <rect x="40" y="70" width="150" height="160" fill="#334155" />
      <rect x="210" y="40" width="200" height="190" fill="#1e3a5f" />
      <rect x="430" y="90" width="160" height="140" fill="#334155" />
      <rect x="230" y="60" width="160" height="18" fill={sky} opacity="0.85" />
      <rect x="250" y="100" width="36" height="90" fill="#38bdf8" opacity="0.35" />
      <rect x="300" y="100" width="36" height="90" fill="#38bdf8" opacity="0.25" />
      <rect x="350" y="100" width="36" height="90" fill="#38bdf8" opacity="0.35" />
      <rect x="80" y="100" width="28" height="40" fill="#fbbf24" opacity="0.7" />
      <rect x="120" y="100" width="28" height="40" fill="#fbbf24" opacity="0.45" />
      <rect y="230" width="640" height="50" fill="#0b1220" />
      <circle cx="120" cy="248" r="16" fill="#475569" />
      <circle cx="210" cy="248" r="16" fill="#475569" />
      <rect x="150" y="236" width="40" height="12" fill="#94a3b8" />
    </svg>
  );
}
