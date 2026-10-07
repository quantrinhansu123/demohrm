"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { changeLivePin } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";

export function ChangePinButton() {
  const [open, setOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await changeLivePin(oldPin, nextPin);
      setDone(true);
      setOldPin("");
      setNextPin("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Đổi PIN thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="xs" onClick={() => { setOpen(true); setDone(false); setError(""); }}>Đổi PIN</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Đổi PIN"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{busy ? "Đang lưu..." : "Lưu PIN"}</Button></>}
      >
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
        {done && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">Đã đổi PIN.</p>}
        <div className="grid gap-3">
          <Field label="PIN hiện tại"><input type="password" className={inputClass} value={oldPin} onChange={(e) => setOldPin(e.target.value)} /></Field>
          <Field label="PIN mới (tối thiểu 4 ký tự)"><input type="password" className={inputClass} value={nextPin} onChange={(e) => setNextPin(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
