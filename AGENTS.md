# AGENTS.md — RevGo Speed

## Proyek

Aplikasi manajemen bengkel **motor** (PWA, mobile-first, bahasa Indonesia). White-label: multi-cabang, multi-tenant, branding via `SystemSetting`.

## Tech Stack

- **Framework:** Next.js 16 (App Router, RSC, server actions)
- **UI:** React 19, Tailwind CSS 4
- **Database:** PostgreSQL (Neon) via Prisma 7
- **Auth:** NextAuth v5 (beta) — JWT strategy, credentials provider
- **Deploy:** Vercel
- **Runtime:** Node.js, package manager: npm

## Perintah

```bash
npm run dev          # dev server (Next dev)
npm run build        # prisma migrate deploy && prisma generate && next build
npm run lint         # eslint .
npm test             # vitest run (unit test sekali jalan)
npm run test:watch   # vitest watch (saat mengembangkan)
npm run db:generate  # regenerate Prisma client → generated/
npm run db:migrate   # prisma migrate dev (butuh DATABASE_URL) — untuk branch DEV
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio
```

## Migrasi DB & Rilis

- **Dev:** perubahan skema via `npm run db:migrate` (branch `dev`) → commit file `prisma/migrations/` **bersama code** yang membutuhkannya (1 commit = skema + code, tidak boleh terpisah).
- **Produksi:** build command Vercel (`vercel.json` → `buildCommand`; override package.json!) menjalankan `prisma migrate deploy` **otomatis setiap deploy** — deploy commit X = migrasi di commit X ikut terjalankan. Tidak ada langkah migrasi manual.
- **Preview deploy** memakai env `DATABASE_URL` scope **Preview** (menunjuk branch `dev`).
- **Expand–contract:** rename/hapus kolom atau perubahan yang tidak backward-compatible wajib **2 fase deploy** — fase 1: tambah struktur baru + code baca/tulis dua-duanya; fase 2 (setelah code lama mati): buang struktur lama. Migrasi yang berjalan **tidak pernah diedit** — koreksi = migrasi baru.
- **Cek sebelum rilis besar:** `npx prisma migrate status` (pending?) dan `npx prisma migrate diff` (drift antara DB dan folder migrasi).

## Path Alias

- `@/*` → `src/*`
- `@db/*` → `generated/*` (Prisma client hasil generate — **jangan edit manual, jangan commit**)

## Struktur

```
src/
  app/
    (customer)/pesanan/     # customer: booking, riwayat, approve estimasi
    (staff)/dashboard/      # staff: servis, stok, kas, laporan, piutang,
                            #   katalog, pengaturan, akun, backup, tugas
    api/backup/export/      # export JSON (Owner/SysAdmin)
    api/laporan/export/     # export CSV laporan
    login/ register/        # auth pages
  components/               # brand-mark, staff-nav, login/register form
  lib/
    auth.ts                 # NextAuth config + callbacks
    guard.ts                # requireStaff, requireStaffRole, getStaffBranchId
    branding.ts             # getBranding (nama/logo dari SystemSetting)
    prisma.ts               # PrismaClient singleton (adapter pg)
    password.ts             # scrypt hash/verify
    role.ts                 # homePathForRole
    service-status.ts       # STATUS_LABEL, STATUS_COLOR, formatRupiah, formatTanggal
prisma/
  schema.prisma             # skema database
  seed.ts                   # seed: branch Pusat, settings, owner, sysadmin
  migrations/               # SQL migrations
scripts/                    # test-flow-*.ts, cleanup-test.ts, gen-icons.mjs, verify-neon.ts, check-neon-sync.ts
docs/PRD.md                 # product requirements (v0.3)
generated/                  # Prisma client output (gitignored)
```

## Konvensi Kode

- **Server actions** di file `actions.ts` per halaman, pakai pola:
  ```ts
  "use server";
  export type XxxState = { error?: string; success?: string };
  export async function doThing(_prev: XxxState, formData: FormData): Promise<XxxState> { ... }
  ```
  Dipanggil dari client component via `useActionState`.
- **Format:** Rupiah via `formatRupiah()` (integer, tanpa desimal), tanggal via `formatTanggal()` / `formatTanggalPendek()` — semua di `src/lib/service-status.ts`.
- **Bahasa:** Seluruh UI, label, dan pesan error dalam bahasa Indonesia.
- **Desain:** Mobile-first, max-width `max-w-lg` (staff) / `max-w-md` (customer), bottom-nav, Tailwind utility classes, tidak pakai component library eksternal.
- **Design system:** token di `src/app/globals.css` (`@theme`) — CTA/active `bg-primary` (#D32F2F), top navbar `bg-secondary` (#1E293B), halaman `bg-background` (#F8FAFC), kartu `bg-surface` + `shadow-card` (radius 12/16px), teks `text-foreground` / `text-muted-foreground`, status `text-success` / `text-warning`, font Inter via `--font-sans`. **Jangan pakai hex warna hardcoded** di komponen — gunakan token ini.
- **Warna status servis:** konsisten di `STATUS_COLOR` (`src/lib/service-status.ts`).
- **Nilai moneter:** selalu integer (Rupiah), jangan float.

## Model Domain (ringkas)

- **Role:** `OWNER`, `SYS_ADMIN`, `ADMIN`, `MECHANIC`, `CUSTOMER`
- **ServiceStatus flow:**
  `PENDING → WAITING_APPROVAL → CONFIRMED → CHECKED_IN → IN_PROGRESS ⇄ WAITING_PARTS → DONE`
  (`CANCELLED` dari PENDING/WAITING_APPROVAL/CONFIRMED/CHECKED_IN, wajib alasan)
- **Scoping cabang:** Owner & SysAdmin lintas cabang (`branchId = null`); Admin & Mekanik terikat 1 cabang. Selalu filter query via `getStaffBranchId()`.
- **Kantong kas:** `CashflowAccount` = `KAS` | `BANK`. Pembayaran `CASH` → KAS; `QRIS`/`TRANSFER` → BANK.
- **HPP:** `ServicePart.cost` = snapshot `buyPrice` saat part dipakai — jangan diubah setelah dibuat.

## Aturan Penting

1. **Stok tidak boleh negatif.** Selalu cek `quantity` sebelum decrement; gunakan `prisma.$transaction` untuk operasi multi-tabel (part + movement + cashflow).
2. **Kas dari pembayaran/pembelian dibuat dalam transaksi DB yang sama** dengan Payment/StockMovement — jangan terpisah.
3. **Jangan pernah commit `.env`, `.env.local`, atau `generated/`.**
4. **Perubahan skema Prisma** → jalankan `npm run db:migrate`, commit file `migrations/` yang dihasilkan.
5. **Setelah ubah `schema.prisma`** → `npm run db:generate` agar types di `generated/` update.
6. **Role guard di setiap server action** — jangan hanya andalkan UI hide/show.
7. **Jangan hardcode nama aplikasi** — pakai `getAppName()` / `getBranding()` dari `src/lib/branding.ts`.
8. **Jangan pernah sebut "RevLedger"** — nama lama project sebelum rebrand. Nama resmi: **RevGo Speed**. Jika menemukan sisa referensi "RevLedger" di mana pun, hapus/ganti.
9. **Token/credential wajib aman:** `.env` di-gitignore; token OAuth MCP di `~/.local/share/opencode/mcp-auth.json` (lokal, jangan commit); Vercel env vars disimpan sebagai Secret. Jangan pernah log, print, atau commit secret ke repo.

## Branding & Naming (eksternal)

| Service | Nama | Catatan |
|---------|------|---------|
| GitHub repo | `imtopp/RevGo-Speed` | |
| Vercel project | `revgo-speed` | `AUTH_URL=https://revgo-speed.vercel.app` |
| Neon project | `RevGo Speed` (`green-hill-87037178`) | Org: `red-brook-12514567` |
| Neon branch | `production` (default), `dev` (lokal) | Dev: dipakai `DATABASE_URL` lokal |
| Package name | `revgo-speed` | |

## Neon MCP

- Config di **project-level** `opencode.json` (bukan global `~/.config/opencode/`).
- Auth via OAuth: `opencode mcp auth Neon` (CLI, butuh browser).
- Token tersimpan di `~/.local/share/opencode/mcp-auth.json`.
- Tools tersedia untuk: list/create branch, run SQL, inspect project, dsb.

## Environment (Windows)

- Shell: **PowerShell** — `npx` / `opencode` / `vercel` sering diblokir execution policy → gunakan `npx.cmd`, `opencode.cmd`, `vercel.cmd`.

## Environment Variables

Lihat `.env.example`. Yang dibutuhkan:

```
DATABASE_URL="postgresql://..."   # Neon Postgres
AUTH_SECRET="..."                 # openssl rand -hex 32
AUTH_URL="http://localhost:3000"  # production: URL Vercel
```

## Testing

- **Unit test: Vitest** (`vitest.config.ts`, pola `src/**/*.test.ts`, environment node). Modul murni yang sudah dicover: `src/lib/service-status.ts`, `password.ts`, `role.test.ts` — jalankan `npm test`.
- **Aturan wajib — test mengikuti perubahan:** setiap mengubah/menambah fitur, fungsi, atau modul → **sesuaikan unit test-nya**: perbaiki test lama yang terdampak, tambahkan test untuk perilaku baru. `npm test` + `npm run lint` harus hijau **sebelum commit**. Perubahan yang membuat test gagal = belum selesai (jangan di-skip/di-disable).
- **Belum dicover unit test** (butuh DB/auth): server actions, `guard.ts`, `branding.ts`, prisma query → smoke test manual via `scripts/test-flow-*.ts` (jalankan dengan `npx tsx scripts/test-flow-b.ts` dst., butuh server/app berjalan atau DATABASE_URL valid). Rencana fase 2: integration test terhadap branch `dev`.

Verifikasi DB Neon:
- Cek koneksi cepat: `npx tsx scripts/verify-neon.ts`
- Cek sync skema + seed + integritas (stok negatif): `npx tsx scripts/check-neon-sync.ts`
