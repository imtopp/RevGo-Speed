import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth";
import { ruleFor, windowStartFor, isOverLimit } from "@/lib/rate-limit";

/**
 * Rate limit dua lapis:
 * - L1 in-memory per isolate: cek cepat, tanpa latensi DB.
 * - L2 tabel RateLimitBucket di Neon: counter BERSAMA lintas isolate Vercel
 *   (ini yang bikin proteksi berlaku sungguhan di production serverless).
 *
 * Jika DB tidak tersedia → fail-open (availability), L1 tetap berlaku.
 */

const local = new Map<string, { count: number; reset: number }>();
const MAX_LOCAL = 10_000;

function tooMany(retrySec: number) {
  return NextResponse.json(
    { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
    { status: 429, headers: { "Retry-After": String(retrySec) } },
  );
}

function localHit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (local.size > MAX_LOCAL) {
    for (const [k, v] of local) {
      if (v.reset <= now) local.delete(k);
    }
  }
  const b = local.get(key);
  if (!b || b.reset <= now) {
    local.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return !isOverLimit(b.count, limit);
}

async function sharedHit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const sql = neon(url);
    const ws = windowStartFor(Date.now(), windowMs);
    const rows = await sql`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", count)
      VALUES (${key}, ${new Date(ws).toISOString()}, 1)
      ON CONFLICT ("key") DO UPDATE SET
        count = CASE
          WHEN "RateLimitBucket"."windowStart" < EXCLUDED."windowStart" THEN 1
          ELSE "RateLimitBucket".count + 1
        END,
        "windowStart" = EXCLUDED."windowStart"
      RETURNING count
    `;
    const count = Number(rows[0]?.count ?? 0);
    // Bersihkan bucket basi sesekali (±1 dari 200 request).
    if (Math.random() < 0.005) {
      await sql`DELETE FROM "RateLimitBucket" WHERE "windowStart" < now() - interval '1 day'`;
    }
    return !isOverLimit(count, limit);
  } catch {
    return null;
  }
}
export async function proxy(request: NextRequest) {
  // Paksa ganti password sebelum halaman apa pun — berlaku selama flag
  // mustChange ada di token (dihapus saat ganti password + login ulang).
  // Cek di sini, sebelum rate-limit: path tanpa rule tetap harus kena.
  // Kecualian path disetel ketat (exact / prefix + "/") — jangan sampai
  // "/api/auth-something" ikut lolos dari paksaan ganti password.
  const session = await auth();
  const path = request.nextUrl.pathname;
  if (
    session?.user?.mustChange &&
    path !== "/ganti-password" &&
    path !== "/api/auth" &&
    !path.startsWith("/api/auth/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/ganti-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rule = ruleFor(request.nextUrl.pathname, request.method);
  if (!rule) return NextResponse.next();

  const key = `${ip}:${rule.scope}`;

  if (!localHit(key, rule.limit, rule.windowMs)) {
    return tooMany(Math.ceil(rule.windowMs / 1000));
  }
  const shared = await sharedHit(key, rule.limit, rule.windowMs);
  if (shared === false) {
    return tooMany(Math.ceil(rule.windowMs / 1000));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Kecualikan SEMUA internal Next (static, image, HMR websocket, RSC) —
    // proxy hanya boleh menyentuh request aplikasi & API.
    "/((?!_next/|favicon\\.ico|icons/|manifest\\.webmanifest|robots\\.txt).*)",
  ],
};
