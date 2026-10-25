import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Validasi password baru (ganti password). null = lolos. */
export function validasiPasswordBaru(baru: string, konfirmasi: string): string | null {
  if (baru.length < 6) return "Password baru minimal 6 karakter.";
  if (baru !== konfirmasi) return "Konfirmasi password tidak cocok.";
  return null;
}
