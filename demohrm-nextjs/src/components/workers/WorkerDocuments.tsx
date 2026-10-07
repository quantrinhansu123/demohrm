"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { requestDocumentUpload, saveWorkerDocument } from "@/lib/live";
import { inputClass } from "@/components/ui/modal";

export function WorkerDocuments({ workerId }: { workerId: number }) {
  const [docType, setDocType] = useState("national_id");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
      setMsg("Chỉ nhận JPEG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 1_500_000) {
      setMsg("Ảnh tối đa 1.5MB.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const signed = await requestDocumentUpload(workerId, { mime: file.type, filename: file.name });
      const put = await fetch(signed.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Tải ảnh lên kho thất bại.");
      await saveWorkerDocument(workerId, { doc_type: docType, storage_path: signed.path, mime: file.type });
      setMsg("Đã lưu giấy tờ.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Tải giấy tờ thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-full mt-3 rounded-xl border border-slate-100 p-3">
      <div className="mb-2 text-[13px] font-semibold text-slate-800">Giấy tờ</div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="national_id">Ảnh CCCD</option>
          <option value="portrait">Ảnh chân dung</option>
        </select>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} className="text-[12.5px]" />
      </div>
      {msg && <p className="mt-2 text-[12.5px] text-slate-600">{msg}</p>}
    </div>
  );
}
