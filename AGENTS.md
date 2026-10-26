# AGENTS.md â€” RevGo Speed

## Proyek

Aplikasi manajemen bengkel **motor** (PWA, mobile-first, bahasa Indonesia). White-label: multi-cabang, multi-tenant, branding via `SystemSetting`.

## Tech Stack

- **Framework:** Next.js 16 (App Router, RSC, server actions)
- **UI:** React 19, Tailwind CSS 4
- **Database:** PostgreSQL (Neon) via Prisma 7
- **Auth:** NextAuth v5 (beta) â€” JWT strategy, credentials provider
- **Deploy:** Vercel
- **Runtime:** Node.js, package manager: npm

## Perintah

```bash
npm run dev          # dev server (Next dev)
npm run build        # prisma migrate deploy && prisma generate && next build
npm run lint         # eslint .
npm test             # vitest run (unit test sekali jalan)
npm run test:watch   # vitest watch (saat mengembangkan)
npm run db:generate  # regenerate Prisma client â†’ generated/
npm run db:migrate   # prisma migrate dev (butuh DATABASE_URL) â€” untuk branch DEV
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio
```

## Migrasi DB & Rilis

- **Dev:** perubahan skema via `npm run db:migrate` (branch `dev`) â†’ commit file `prisma/migrations/` **bersama code** yang membutuhkannya (1 commit = skema + code, tidak boleh terpisah).
- **Produksi:** build command Vercel (`vercel.json` â†’ `buildCommand`; override package.json!) menjalankan `prisma migrate deploy` **otomatis setiap deploy** â€” deploy commit X = migrasi di commit X ikut terjalankan. Tidak ada langkah migrasi manual.
- **Preview deploy** memakai env `DATABASE_URL` scope **Preview** (menunjuk branch `dev`).
- **Expandâ€“contract:** rename/hapus kolom atau perubahan yang tidak backward-compatible wajib **2 fase deploy** â€” fase 1: tambah struktur baru + code baca/tulis dua-duanya; fase 2 (setelah code lama mati): buang struktur lama. Migrasi yang berjalan **tidak pernah diedit** â€” koreksi = migrasi baru.
- **Cek sebelum rilis besar:** `npx prisma migrate status` (pending?) dan `npx prisma migrate diff` (drift antara DB dan folder migrasi).

## Path Alias

- `@/*` â†’ `src/*`
- `@db/*` â†’ `generated/*` (Prisma client hasil generate â€” **jangan edit manual, jangan commit**)

## Struktur

```
src/
  app/
    (customer)/pesanan/     # customer: booking, riwayat, approve estimasi
    (staff)/dashboard/      # staff: servis, stok, kas, laporan, piutang,
                            #   katalog, pengaturan, akun, backup, tugas
    api/backup/export/      # export JSON seluruh tabel (OWNER+SYS_ADMIN, passwordHash ikut)
    api/backup/import/      # restore penuh dari file (konfirmasi RESTORE, 1 transaksi)
    lib/backup.ts           # daftar tunggal BACKUP_TABLES — wajib sinkron dgn schema.prisma
                            #   (backup.test.ts membaca schema, gagal otomatis bila lupa)
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
- **Format:** Rupiah via `formatRupiah()` (integer, tanpa desimal), tanggal via `formatTanggal()` / `formatTanggalPendek()` â€” semua di `src/lib/service-status.ts`.
- **Bahasa:** Seluruh UI, label, dan pesan error dalam bahasa Indonesia.
- **Desain:** Mobile-first, max-width `max-w-lg` (staff) / `max-w-md` (customer), bottom-nav, Tailwind utility classes, tidak pakai component library eksternal.
- **Design system:** token di `src/app/globals.css` (`@theme`) â€” CTA/active `bg-primary` (#D32F2F), top navbar `bg-secondary` (#1E293B), halaman `bg-background` (#F8FAFC), kartu `bg-surface` + `shadow-card` (radius 12/16px), teks `text-foreground` / `text-muted-foreground`, status `text-success` / `text-warning`, font Inter via `--font-sans`. **Jangan pakai hex warna hardcoded** di komponen â€” gunakan token ini.
- **Warna status servis:** konsisten di `STATUS_COLOR` (`src/lib/service-status.ts`).
- **Nilai moneter:** selalu integer (Rupiah), jangan float.

## Model Domain (ringkas)

- **Role:** `OWNER`, `SYS_ADMIN`, `ADMIN`, `MECHANIC`, `CUSTOMER`
- **ServiceStatus flow:**
  `PENDING â†’ WAITING_APPROVAL â†’ CONFIRMED â†’ CHECKED_IN â†’ IN_PROGRESS â‡„ WAITING_PARTS â†’ DONE`
  (`CANCELLED` dari PENDING/WAITING_APPROVAL/CONFIRMED/CHECKED_IN, wajib alasan)
- **Scoping cabang:** Owner & SysAdmin lintas cabang (`branchId = null`); Admin & Mekanik terikat 1 cabang. Selalu filter query via `getStaffBranchId()`.
- **Kantong kas:** `CashflowAccount` = `KAS` | `BANK`. Pembayaran `CASH` â†’ KAS; `QRIS`/`TRANSFER` â†’ BANK.
- **HPP:** `ServicePart.cost` = campuran harga beli batch (alokasi FIFO `PartBatchUsage`) â€” hanya boleh berubah lewat `correctStockCost` (koreksi 4 langkah, terbatas unit dari batch terkait). Baca di laporan: `Î£ costÃ—qty` per servis DONE.

## Aturan Penting

1. **Stok tidak boleh negatif.** Selalu cek `quantity` sebelum decrement; gunakan `prisma.$transaction` untuk operasi multi-tabel (part + movement + cashflow).
2. **Kas dari pembayaran/pembelian dibuat dalam transaksi DB yang sama** dengan Payment/StockMovement â€” jangan terpisah.
3. **Jangan pernah commit `.env`, `.env.local`, atau `generated/`.**
4. **Perubahan skema Prisma** â†’ jalankan `npm run db:migrate`, commit file `migrations/` yang dihasilkan.
5. **Setelah ubah `schema.prisma`** â†’ `npm run db:generate` agar types di `generated/` update.
6. **Role guard di setiap server action** â€” jangan hanya andalkan UI hide/show.
7. **Jangan hardcode nama aplikasi** â€” pakai `getAppName()` / `getBranding()` dari `src/lib/branding.ts`.
8. **Jangan pernah sebut "RevLedger"** â€” nama lama project sebelum rebrand. Nama resmi: **RevGo Speed**. Jika menemukan sisa referensi "RevLedger" di mana pun, hapus/ganti.
9. **Token/credential wajib aman:** `.env` di-gitignore; token OAuth MCP di `~/.local/share/opencode/mcp-auth.json` (lokal, jangan commit); Vercel env vars disimpan sebagai Secret. Jangan pernah log, print, atau commit secret ke repo.
10. **Cek integritas akuntansi setiap ada modifikasi (WAJIB sebelum commit).** Setiap perubahan yang menyentuh uang, stok, HPP, omzet, kas, atau laporan â†’ audit alur dulu: (a) **kas = uang real** â€” tiap uang nyata bergerak tepat satu baris `Cashflow` (tanda/bulan/kantong benar), tidak ada kas fiktif (baris kas tanpa uang) maupun kas hilang (uang bergerak tanpa baris); (b) **laporan vs uang real tidak selisih karena salah alur** â€” telusuri semua jalur tulis (payment, pembelian, koreksi, opname, void, kas manual) dan cocokkan dengan semua jalur baca laporan (`laporan/page.tsx` + `api/laporan/export`); (c) **konservasi stok** â€” `part.quantity` selalu = Î£ IN âˆ’ Î£ OUT gerakan; (d) **konservasi batch/FIFO** â€” alokasi â‰¤ qty batch, koreksi HPP terbatas unit terpakai; (e) **tidak ada data hilang** â€” migrasi additive, backup memuat semua tabel (termasuk `PartBatchUsage`), delete/cascade tidak menyingkirkan jejak yang dibutuhkan laporan. Fallback snapshot (mis. `cost ?? buyPrice`) hanya boleh untuk data lama, dicatat sebagai aproksimasi.

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

- Shell: **PowerShell** â€” `npx` / `opencode` / `vercel` sering diblokir execution policy â†’ gunakan `npx.cmd`, `opencode.cmd`, `vercel.cmd`.

### Restart dev server â€” WAJIB pakai script

- **Selalu** restart dev server dengan: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restart-dev.ps1`
  - Script ini mematikan semua proses node dev project (by path) + pemilik port 3000, lalu start ulang terpisah, probe `/login` maks 30 detik â†’ output `DEV-OK (n detik)` atau `DEV-TIMEOUT` + exit. **Selalu berhenti sendiri** â€” tidak menggantung.
  - Log dev: `%TEMP%\opencode\devlog.txt`.
- **JANGAN** menulis perintah restart inline (kombinasi `Start-Process` + `Start-Sleep` + `Invoke-WebRequest` timeout panjang) â€” pola itu berulang kali nyangkut di tengah sesi sehingga user harus Esc berkali-kali.
- Tool timeout untuk memanggil script: 60000 ms (cukup untuk kasus terburuk 30 detik + margin).

## Environment Variables

Lihat `.env.example`. Yang dibutuhkan:

```
DATABASE_URL="postgresql://..."   # Neon Postgres
AUTH_SECRET="..."                 # openssl rand -hex 32
AUTH_URL="http://localhost:3000"  # production: URL Vercel
```

## Testing

- **Unit test: Vitest** (`vitest.config.ts`, pola `src/**/*.test.ts`, environment node). Modul murni yang sudah dicover: `src/lib/service-status.ts`, `password.ts`, `role.test.ts` â€” jalankan `npm test`.
- **Aturan wajib â€” test mengikuti perubahan:** setiap mengubah/menambah fitur, fungsi, atau modul â†’ **sesuaikan unit test-nya**: perbaiki test lama yang terdampak, tambahkan test untuk perilaku baru. `npm test` + `npm run lint` harus hijau **sebelum commit**. Perubahan yang membuat test gagal = belum selesai (jangan di-skip/di-disable).
- **Belum dicover unit test** (butuh DB/auth): server actions, `guard.ts`, `branding.ts`, prisma query â†’ smoke test manual via `scripts/test-flow-*.ts` (jalankan dengan `npx tsx scripts/test-flow-b.ts` dst., butuh server/app berjalan atau DATABASE_URL valid). Rencana fase 2: integration test terhadap branch `dev`.

Verifikasi DB Neon:
- Cek koneksi cepat: `npx tsx scripts/verify-neon.ts`
- Cek sync skema + seed + integritas (stok negatif): `npx tsx scripts/check-neon-sync.ts`
