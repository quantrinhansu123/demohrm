"use client";

import Image from "next/image";
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#e8eef6] px-4 py-8">
      <Image
        src="/images/logo.png"
        alt=""
        width={1024}
        height={1024}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-[min(120vw,860px)] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.18] mix-blend-multiply"
      />
      <form onSubmit={(e) => void submit(e)} className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,53,103,0.1)]">
        <Image
          src="/images/logo.png"
          alt="Trang Way"
          width={1024}
          height={1024}
          priority
          className="mx-auto -my-3 h-auto w-[min(100%,300px)]"
        />
        <h1 className="sr-only">Trang Way</h1>
        <p className="text-center text-[13px] text-slate-500">Đăng nhập bằng mã nhân viên. Vai trò lấy từ hồ sơ trên máy chủ.</p>
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
