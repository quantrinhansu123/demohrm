import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPin(pin: string, saltHex?: string): string {
  const salt = saltHex ?? randomBytes(16).toString("hex");
  const derived = scryptSync(pin, Buffer.from(salt, "hex"), KEYLEN, { N, r: R, p: P }).toString("hex");
  return `scrypt$${N}$${R}$${P}$${salt}$${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, expected] = parts as [string, string, string, string, string, string];
  const derived = scryptSync(pin, Buffer.from(salt, "hex"), KEYLEN, { N: Number(n), r: Number(r), p: Number(p) });
  const exp = Buffer.from(expected, "hex");
  return derived.length === exp.length && timingSafeEqual(derived, exp);
}

export function seedSalt(code: string): string {
  return createHash("sha256").update(`trangway-pin:${code}`).digest("hex").slice(0, 32);
}
