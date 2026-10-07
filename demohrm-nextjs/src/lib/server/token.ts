import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/server/env";

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

function sign(secret: string, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function read(secret: string, token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 2) throw new TokenError("Token khong hop le.");
  const payload = parts[0];
  const sig = parts[1];
  if (!payload || !sig) throw new TokenError("Token khong hop le.");
  const expect = createHmac("sha256", secret).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) {
    throw new TokenError("Chu ky token khong hop le.");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as unknown;
}

export function signHandover(hid: number, ttlHours: number): string {
  if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 168) {
    throw new TokenError("Thoi han link phai tu 1 den 168 gio.");
  }
  return sign(serverEnv.handoverSecret, { typ: "handover", hid, exp: Date.now() + ttlHours * 3600_000 });
}

export function verifyHandover(token: string): number {
  const data = read(serverEnv.handoverSecret, token) as Partial<{ typ: string; hid: number; exp: number }>;
  if (data.typ !== "handover" || !Number.isFinite(data.hid) || !Number.isFinite(data.exp) || Date.now() > (data.exp as number)) {
    throw new TokenError("Link xac nhan khong hop le hoac da het han.");
  }
  return data.hid as number;
}

export function signSession(sid: number, role: string): string {
  return sign(serverEnv.authSecret, { typ: "session", sid, role, exp: Date.now() + serverEnv.sessionTtlHours * 3600_000 });
}

export function verifySession(token: string): { sid: number; role: string } {
  const data = read(serverEnv.authSecret, token) as Partial<{ typ: string; sid: number; role: string; exp: number }>;
  if (data.typ !== "session" || !Number.isFinite(data.sid) || typeof data.role !== "string" || !Number.isFinite(data.exp) || Date.now() > (data.exp as number)) {
    throw new TokenError("Phien dang nhap khong hop le.");
  }
  return { sid: data.sid as number, role: data.role };
}
