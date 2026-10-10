"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { changePinLive } from "@/lib/live";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";

export function ChangePinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const save = async () => {
    if (!oldPin) {
      setError("Nhập PIN (mật khẩu) hiện tại.");
      return;
    }
    if (!newPin || newPin.length < 4) {
      setError("PIN mới tối thiểu 4 ký tự.");
      return;
    }
    if (newPin !== confirm) {
      setError("Xác nhận PIN mới chưa khớp.");
      return;
    }
    setSaving(true);
    setError("");
    setOk("");
    try {
      await changePinLive({ old_pin: oldPin, new_pin: newPin });
      setOk("Đổi mật khẩu thành công.");
      setOldPin("");
      setNewPin("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Đổi mật khẩu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đổi mật khẩu (PIN)"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
            {saving ? "Đang lưu..." : "Đổi mật khẩu"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
        {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{ok}</p>}
        <Field label="PIN hiện tại *">
          <input type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} className={inputClass} autoComplete="current-password" />
        </Field>
        <Field label="PIN mới *">
          <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} className={inputClass} placeholder="Tối thiểu 4 ký tự" autoComplete="new-password" />
        </Field>
        <Field label="Xác nhận PIN mới *">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} placeholder="Nhập lại PIN mới" autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  );
}
