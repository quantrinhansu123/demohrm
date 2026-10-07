"use client";

import { FormEvent, useState } from "react";
import { loginError, useSession } from "@/lib/session";

export function LoginScreen() {
  const { login } = useSession();
  const [code, setCode] = useState("NV-005");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(code.trim(), pin);
    } catch (err) {
      setError(loginError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6fa] p-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-[20px] font-bold text-slate-900">Trang Way</h1>
        <p className="mt-1 text-[13px] text-slate-500">Đăng nhập bằng mã nhân viên. Vai trò lấy từ hồ sơ trên máy chủ.</p>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
        <label className="mt-4 block text-[12.5px] font-medium text-slate-600">
          Mã nhân viên
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="username" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-[#0052cc]" />
        </label>
        <label className="mt-3 block text-[12.5px] font-medium text-slate-600">
          PIN
          <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-[#0052cc]" />
        </label>
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-lg bg-[#0052cc] px-3 py-2 text-[14px] font-semibold text-white hover:bg-[#0747a6] disabled:opacity-60">
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
