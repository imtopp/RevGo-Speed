/**
 * Aturan & matematika rate limit (murni — unit-testable).
 * Eksekusi hit/counter ada di src/proxy.ts (in-memory + tabel RateLimitBucket).
 */

export type RateRule = { limit: number; windowMs: number; scope: string };

const AUTH: RateRule = { limit: 20, windowMs: 60_000, scope: "auth" };
const LOGIN_POST: RateRule = { limit: 10, windowMs: 60_000, scope: "auth-page" };
const AUTH_GET: RateRule = { limit: 60, windowMs: 60_000, scope: "auth-page" };
const EXPORT: RateRule = { limit: 10, windowMs: 60_000, scope: "export" };
const MUTATE: RateRule = { limit: 60, windowMs: 60_000, scope: "mutate" };

/**
 * Pilih aturan rate limit berdasarkan path + method.
 * GET halaman biasa di-loloskan (read-only, tidak mahal).
 */
export function ruleFor(path: string, method: string): RateRule | null {
  if (path.startsWith("/api/auth/")) {
    // Session/CSRF GET sering dipanggil tiap navigasi — tidak dibatasi.
    return method === "GET" ? null : AUTH;
  }
  if (path === "/login" || path === "/register") {
    // POST = server action login/register → ketat.
    return method === "POST" ? LOGIN_POST : AUTH_GET;
  }
  if (
    path.startsWith("/api/backup/export") ||
    path.startsWith("/api/laporan/export")
  ) {
    return EXPORT;
  }
  if (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  ) {
    // Cakup SEMUA server action & endpoint mutasi — bukan cuma auth.
    return MUTATE;
  }
  return null;
}

/** Awal window fixed (dibulatkan ke bawah) — deterministik & monotonic. */
export function windowStartFor(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

export function isOverLimit(count: number, limit: number): boolean {
  return count > limit;
}
