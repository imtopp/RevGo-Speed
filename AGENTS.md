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
- **Nomor HP/WA** (`src/lib/wa.ts`): tampilan lokal `0812xxxxxxxx` via `formatWaLocal()`, penyimpanan kanonik `628…` via `normalizeWa()`, link chat via `waLink()` â€” jangan format nomor manual; placeholder form `0812xxxxxxxx`.
- **Bahasa:** Seluruh UI, label, dan pesan error dalam bahasa Indonesia.
- **Desain:** Mobile-first, max-width `max-w-lg` (staff) / `max-w-md` (customer), bottom-nav, Tailwind utility classes, tidak pakai component library eksternal.
- **Design system:** token di `src/app/globals.css` (`@theme`) â€” CTA/active `bg-primary` (#D32F2F), top navbar `bg-secondary` (#1E293B), halaman `bg-background` (#F8FAFC), kartu `bg-surface` + `shadow-card` (radius 12/16px), teks `text-foreground` / `text-muted-foreground`, status `text-success` / `text-warning`, font Inter via `--font-sans`. **Jangan pakai hex warna hardcoded** di komponen â€” gunakan token ini.
- **Warna status servis:** konsisten di `STATUS_COLOR` (`src/lib/service-status.ts`).
- **Nilai moneter:** selalu integer (Rupiah), jangan float.
- **Navigasi PWA (native-like):** pindah tab bottom-nav / sheet "Lainnya" wajib lewat `handleTabNavigate` (`src/lib/tab-history.ts`) — riwayat runtuh ke Beranda dulu agar back dari tab mana pun → Beranda; tombol "Kembali" pakai `BackLink` (`history.back()` hanya bila halaman sebelumnya = targetnya); ganti query (PendingLink, paginasi, "Semua tanggal") wajib `replace`; cetak nota tetap satu tab (jangan `target="_blank"`).

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

## Instance Ganda (RevGo + TBRT)

Aplikasi sama di-deploy untuk 2 pelanggan dari **1 repo** (bukan fork):

| | Instance RevGo | Instance TBRT |
|--|----------------|---------------|
| Vercel project | `revgo-speed` | `tbrt` (`tbrt.vercel.app`) |
| Neon project | `RevGo Speed` | `TBRT` (`summer-smoke-34764554`) |
| Branch git production | `main` | `release/tbrt` (pointer ke 1 SHA `main`) |
| Workspace lokal | folder ini (`RevGo-Speed`) | sejajar `..\TBRT` (clone repo sama, `.env` sendiri) |
| Ignore build | skip push selain `main`/`preview` | skip push selain `release/tbrt` |

- **Rilis:** push ke `main` -> deploy RevGo. Tarik ke TBRT lewat halaman **Update**
  (`/dashboard/update`, **SYS_ADMIN saja** — Owner tidak akses): pointer `release/tbrt` dipindah ke SHA
  `main` terbaru via GitHub API -> Vercel build otomatis. **Rollback** di halaman
  sama: pointer dikembalikan ke SHA sebelumnya (riwayat: SystemSetting
  `update_history` / `update_pending`, TTL build 8 menit).
- **Wajib sebelum tarik/rollback:** unduh backup JSON; server mencentang-balik
  checkbox `backupDone` + kata konfirmasi ketik `PERBARUI` / `KEMBALIKAN`.
- **Env channel** (kedua project Vercel): `UPDATE_CHANNEL_BRANCH` (`main` /
  `release/tbrt`), `GITHUB_REPO=imtopp/RevGo-Speed`, `GITHUB_TOKEN` (PAT isi
  Contents read+write), `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` +
  `VERCEL_TEAM_ID` (dipakai `src/lib/vercel-deploy.ts` untuk memicu build
  ulang setelah ref pindah — Vercel melewatkan webhook pada sha yang sudah
  pernah dibangun, kasus rollback/tarik-ulang; `VERCEL_TOKEN` wajib PAT dari
  dashboard `vercel.com/account/tokens`, token OAuth CLI kedaluwarsa ±12 jam),
  plus `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `AUTH_SECRET`, `AUTH_URL`, `HIDE_EV_MEREK`
  (TBRT `true` â€” tanpa motor listrik; RevGo tidak di-set),
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
  (Web Push — pair sama di kedua project; subscription per-DB).
- **Production branch Vercel** (Environments -> Production -> Branch Tracking)
  **hanya bisa di-set via dashboard**, tidak ada API-nya. Setelah di-set,
  trigger build pertama dengan push kosong ke `release/tbrt`.
- Migrasi DB jalan di build (`prisma migrate deploy`): jalankan migrasi di
  `main` dulu (deploy RevGo) **baru** tarik ke TBRT.
- Logika murni channel + unit test: `src/lib/update-channel.ts` (test: `update-channel.test.ts`);
  helper GitHub: `src/lib/update-github.ts`; pemicu build ulang Vercel:
  `src/lib/vercel-deploy.ts` (test: `vercel-deploy.test.ts`).

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
HIDE_EV_MEREK="true"              # opsional: sembunyikan group motor listrik
                                  #   (TBRT=true; RevGo tidak di-set)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..." # Web Push public key (boleh terbit)
VAPID_PRIVATE_KEY="..."           # Web Push PRIVATE - hanya env Vercel,
                                  #   jangan commit/print/log (push mati
                                  #   senyap kalau kosong)
TELEGRAM_BOT_TOKEN="..."          # opsional - token bot @BotFather; channel
                                  #   cadangan staf (mati senyap kalau kosong)
```

## Web Push (notifikasi)

- Inti: `src/lib/push.ts` (payload+dedupKey+seleksi penerima murni, orchestrator
  `notify*`), server action `src/lib/push-actions.ts` (save/remove subscription),
  kartu opt-in `src/components/push-opt-in-card.tsx` (Beranda staff OWNER/ADMIN +
  halaman Pesanan), handler `push`/`notificationclick` di `public/sw.js`
  (cache v5). Test: `src/lib/push.test.ts`.
- Skema: model `PushSubscription` (endpoint @unique, FK User cascade) +
  `PushSent` (dedupKey @unique) - **wajib ikut `BACKUP_TABLES`** (backup.test).
- **Kirim hanya via `after()` + try/catch** setelah aksi sukses - push gagal
  tidak pernah menggagalkan aksi bisnis; tanpa env VAPID = no-op.
- **Anti-dobel wajib dipertahankan:** guard status/crossing minStock -> klaim
  `PushSent.dedupKey` unique sebelum kirim (P2002 = skip) -> payload `tag`
  (OS replace) -> endpoint unique. Jangan kirim tanpa klaim.
- **Header `Topic` wajib lewat `topicAman(tag)`** (`src/lib/push.ts`) - dedupKey
  mentah ber-`:` membuat `web-push` melethrow sebelum HTTP (gagal senyap, ditelan
  catch per-langganan - pernah membuat 0 notif produksi terkirim).
- Diagnostik kirim manual (env `TEST_DB`, `TEST_PUB`, `TEST_PRIV`, opsional
  `TEST_TOPIC` - cetak OK/FAIL saja, tanpa key/endpoint):
  `npx tsx scripts/test-push-tbrt.ts`
- Penerima: booking baru & stok = Owner lintas cabang + Admin cabang; event
  customer = unik [customerId, vehicle.ownerId] ber-role CUSTOMER aktif.
- **Keterbatasan Android (bukan bug aplikasi):** pengiriman latar Chrome/PWA
  tergantung Chrome + OEM HP (iQOO/Xiaomi/OPPO/Vivo agresif → pesan tertahan
  dan tampil saat app dibuka - TIDAK hilang; foreground & desktop selalu
  instan). Chromium #547300529: high-urgency web push belum membangunkan PWA
  setelah layar mati. Mitigasi: kirim selalu `urgency: "high"`. Jangan pernah
  mewajibkan customer setting batre - push = bonus, sumber info = aplikasi.
- Generate ulang pair (jarang): `node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"`
  lalu update env Vercel kedua project (production+preview) - lama otomatis mati.

## Template Notifikasi & Telegram

- **Template push & WA bisa diedit OWNER/SYS_ADMIN** di
  `/dashboard/pengaturan/notifikasi`: 9 template (6 push + 3 WA) — default di
  `TEMPLATE_DEFS` (`src/lib/notif-template.ts`, murni tanpa prisma), override
  di SystemSetting key `notif_templates` (hanya field ≠ default yang
  disimpan). Token `{var}` via `renderTemplate`; variabel opsional membawa
  pemisahnya sendiri (`{alasan}` = " — x"; `{motor}/{layanan}/{jadwal}` =
  baris ber-prefix `\n`) agar default tak pernah menghasilkan baris kosong.
  Loader: `muatTemplateNotif()` (`notif-template-db.ts`) — dipanggil di dalam
  `notify*` / caller WA server; caller client menerima override via **prop**
  (`wa.ts` tetap pure). Test: `notif-template.test.ts`.
- **Telegram = channel GRATIS cadangan staf** (booking baru & stok menipis
  saja; event customer tetap push). Inti: `src/lib/telegram.ts` (config
  JSON SystemSetting `telegram_config`: botUsername, webhookSecret, chats
  userId→chatId, tokens satu-pakai; kirim `sendMessage` plain text + tombol
  "Buka"). Webhook `POST /api/telegram/webhook` (verifikasi header
  `X-Telegram-Bot-Api-Secret-Token`; `/start <token>` → ikat chatId).
  Alur hubungkan: Pengaturan > Notifikasi → "Hubungkan" → tap link t.me →
  Start. **Mati senyap tanpa env `TELEGRAM_BOT_TOKEN`** (buat via
  @BotFather); webhook butuh `AUTH_URL` produksi. Kirim dibungkus
  try/catch — tidak pernah menjatuhkan aksi bisnis; teks = template push
  yang sama. Test: `telegram.test.ts` (bagian murni).

## Testing

- **Unit test: Vitest** (`vitest.config.ts`, pola `src/**/*.test.ts`, environment node). Modul murni yang sudah dicover: `src/lib/service-status.ts`, `password.ts`, `role.test.ts` â€” jalankan `npm test`.
- **Aturan wajib â€” test mengikuti perubahan:** setiap mengubah/menambah fitur, fungsi, atau modul â†’ **sesuaikan unit test-nya**: perbaiki test lama yang terdampak, tambahkan test untuk perilaku baru. `npm test` + `npm run lint` harus hijau **sebelum commit**. Perubahan yang membuat test gagal = belum selesai (jangan di-skip/di-disable).
- **Belum dicover unit test** (butuh DB/auth): server actions, `guard.ts`, `branding.ts`, prisma query â†’ smoke test manual via `scripts/test-flow-*.ts` (jalankan dengan `npx tsx scripts/test-flow-b.ts` dst., butuh server/app berjalan atau DATABASE_URL valid). Rencana fase 2: integration test terhadap branch `dev`.

Verifikasi DB Neon:
- Cek koneksi cepat: `npx tsx scripts/verify-neon.ts`
- Cek sync skema + seed + integritas (stok negatif): `npx tsx scripts/check-neon-sync.ts`
