# PRD — RevGo Speed

**Versi:** 1.1 (Rilis 1 selesai + audit konsistensi)
**Tanggal:** 24 Oktober 2026
**Status:** ✅ Rilis 1 selesai — semua fase A–E terpasang, siap produksi

**Riwayat:**
- v0.1 — draft awal (4 modul rilis 1, multi-cabang, DP+lunas).
- v0.2 — peran **System Administrator**; kebijakan DP/refund & jam operasional jadi **konfigurasi**; alur disesuaikan standar industri bengkel (approval estimasi, QC sebelum serah terima).
- v0.3 — evaluasi gap vs praktik software bengkel (riset komparatif): tambah status **`CHECKED_IN` + pemeriksaan awal unit**, papan kerja, master **supplier**, sumber dana kas (**kantong uang**), menu **piutang**, snapshot **HPP per servis** (laba per job), backup DB; daftar fase 2 diperkaya (opname massal, shift kasir, PO, dsb.).
- v1.0 — **rebrand RevLedger → RevGo Speed** (hostname & branding); migrasi SQLite → **Neon PostgreSQL**; deploy **Vercel** (production) + Neon (DB); semua fase A–E selesai.
- v1.1 — audit konsistensi PRD ↔ implementasi: keputusan cakupan SysAdmin (risiko #6) & angka keuangan mekanik (risiko #5) **ditegakkan di kode**; detail disesuaikan dengan kode aktual (`CANCELLED` + `CHECKED_IN`, kategori kas bebas teks + label otomatis, parameter pengaturan +logo, cakupan laporan/cetak/pencarian, piutang urut tertua + kontak); dukungan **desktop responsif**, **design system**, aset logo.

---

## 1. Ringkasan Produk

**Masalah.** Bengkel kecil-menengah mengelola booking, stok part, dan arus kas lewat buku catatan/WhatsApp/Excel — data tercecer, stok sering meleset, piutang tidak terpantau, dan pemilik tidak punya gambaran keuangan harian.

**Solusi.** RevGo Speed adalah aplikasi web (PWA, mobile-first) yang mengelola operasional bengkel terpadu: booking & proses servis, inventori suku cadang, pencatatan kas & piutang, dan laporan pemilik — dengan akses berbasis peran (owner, system administrator, admin, mekanik, customer). Bersifat **white-label**: nama & logo yang tampil ke customer dikonfigurasi System Administrator per bengkel (mis. "TBRT"), sehingga platform yang sama bisa dipakai banyak bengkel dengan identitas masing-masing.

**Tujuan rilis 1:**
- Satu siklus penuh jalan: booking → estimasi disetujui → pemeriksaan unit → pengerjaan → pembayaran (lunas/DP/piutang) → kas & laporan tercatat otomatis.
- Owner bisa melihat rekap keuangan, piutang, & performa kapan pun, lintas cabang — termasuk **laba kotor per servis**.
- Semua modul inti (Servis, Stok, Kas, Laporan, Pengaturan) tersedia dan dipakai harian dari HP.

**Prinsip desain:** mobile-first (PWA), satu sumber data (semua angka berasal dari transaksi yang sama, tidak input dobel), ringkas — tidak jadi software akuntansi penuh.

---

## 2. Pengguna & Peran

| Peran | Siapa | Kebutuhan utama |
|---|---|---|
| **Owner** | Pemilik bengkel | Semua akses: laporan lintas cabang, katalog, akun, pengaturan |
| **System Administrator** | Staf IT/kantor pusat | Kelola akun, pengaturan sistem, backup data (bukan data keuangan) |
| **Admin** | Karyawan administrasi cabang | Booking, estimasi & konfirmasi, penerimaan unit, pembayaran, stok, kas (1 cabang) |
| **Mekanik** | Teknisi | Daftar tugas saya, precheck/pengerjaan, catat part terpakai & diagnosis |
| **Customer** | Pemilik kendaraan | Booking dari HP, setujui estimasi, pantau status, lihat riwayat & tagihan |

### Matriks izin

| Fitur | Owner | SysAdmin | Admin | Mekanik | Customer |
|---|:--:|:--:|:--:|:--:|:--:|
| Laporan & export CSV | ✔ (lintas cabang) | – | ✔ (cabangnya saja) | – | – |
| Kelola akun staff | ✔ | ✔ | – | – | – |
| Pengaturan sistem & **backup data** | ✔ | ✔ | – | – | – |
| Kelola cabang | ✔ | ✔ | – | – | – |
| Katalog jasa (CRUD) | ✔ | ✔ | ✔ (lihat di form booking) | – | – |
| Booking (input/konfirmasi/estimasi) | ✔ | – | ✔ (cabangnya) | – | ✔ (mandiri) |
| Setujui/tolak estimasi | ✔ | – | ✔ | – | ✔ (pesanan saya) |
| **Penerimaan unit (precheck)** | ✔ | – | ✔ | ✔ | – |
| Proses servis & status | ✔ | – | ✔ | ✔ (tugas saya) | – |
| Catat pembayaran (DP/lunas/piutang) | ✔ | – | ✔ | – | ✔ (bayar saat ambil) |
| Stok part & supplier (CRUD, masuk/keluar) | ✔ | – | ✔ (cabangnya) | ✔ (pakai part) | – |
| Catat kas manual | ✔ | – | ✔ (cabangnya) | – | – |
| Data sendiri (kendaraan, riwayat) | – | – | – | – | ✔ |

**Scoping cabang:** owner & system administrator lintas cabang; admin & mekanik terikat 1 cabang; customer lintas cabang.

**Menu adaptif:** SysAdmin: **Beranda** (tanpa angka keuangan/stok), **Katalog, Akun, Pengaturan, Backup**; Admin: **operasional + piutang**; Mekanik: **Beranda** (tanpa angka keuangan) + **Tugas Saya**.

---

## 3. Alur Inti

### 3.1 Booking → Servis → Bayar

Mengikuti praktik bengkel: penerimaan → **pemeriksaan awal** → estimasi disetujui → pengerjaan → QC → serah terima → bayar (piutang bila perlu):

```
Customer booking (app) ──┐                        ┌ Admin input (telepon/walk-in)
                         └──→ PENDING ────────────┘
                                   ↓ admin isi estimasi + jadwal (diagnosis awal)
                            WAITING_APPROVAL  ← estimasi terkirim ke customer
                                   ↓ setuju (app) / approve di tempat (admin)
                              CONFIRMED  ── unit dijanjikan, belum pasti datang
                                   ↓ unit datang → wajib Pemeriksaan Awal
                              CHECKED_IN  (km, BBM, kondisi existing, keluhan disepakati)
                                   ↓ mekanik mulai (baru boleh setelah precheck ok)
                              IN_PROGRESS ──part kurang?→ WAITING_PARTS
                                   ↑__________ tambah stok ↓
                                   ↓ kerja selesai + cek akhir (QC)
                                DONE → siap diambil → bayar (lunas / sisa DP / piutang)
                                   ↓
                             serah terima unit

PENDING / WAITING_APPROVAL / CONFIRMED / CHECKED_IN ──(batal)→ CANCELLED (wajib alasan)
```

**Pemetaan ke tahapan bengkel umum:**

| Tahapan industri | Implementasi RevGo Speed |
|---|---|
| Penerimaan & antrian (booking) | `PENDING` (booking app atau input admin) |
| Diagnosis & penyusunan estimasi | Admin/mekanik isi estimasi → `WAITING_APPROVAL` |
| Persetujuan pelanggan | Setujui/tolak di halaman Pesanan → `CONFIRMED` |
| **Check-in / pemeriksaan unit** | `CHECKED_IN` + form precheck (km, BBM, kondisi, keluhan) |
| Pengerjaan (work order) | `IN_PROGRESS` ⇄ `WAITING_PARTS`, part mengurangi stok |
| Quality control | Prasyarat `DONE` — cek akhir admin/owner |
| Siap diambil & penagihan | `DONE` + pembayaran (lunas/DP/**piutang**) |
| Serah terima & riwayat | Tercatat di riwayat servis kendaraan (lunas atau dengan sisa) |
| Garansi & pengingat servis berikutnya | Fase 2 (lihat §7) |

**Aturan:**
- Booking di luar jam operasional (konfigurasi per cabang) tetap diterima → antrian buka berikutnya.
- **Tidak ada pengerjaan tanpa persetujuan estimasi** (gerbang `CONFIRMED`) **dan tanpa precheck** (gerbang `CHECKED_IN → IN_PROGRESS`).
- Pemeriksaan awal (`CHECKED_IN`): km/odometer, level BBM (opsional), **kondisi yang sudah ada** (goresan/penyok — teks), keluhan disepakati (prefill booking), waktu terima otomatis. Bukti kondisi awal → acuan serah terima.
- Kerja tambahan di tengah pengerjaan: konfirmasi WA/telepon dulu, lalu update estimasi (approval per-item: fase 2).
- Total tagihan = Σ(part terpakai × harga jual) + biaya jasa. Biaya jasa bisa diubah admin (default katalog; negosiasi tercatat).
- DP hanya jika jenis jasa `allowDp`; kebijakan refund mengikuti Pengaturan sistem (FR-10).
- **Piutang:** unit **boleh diserahkan dengan sisa tagihan** (discretion admin) → sisa tercatat & tampil di menu Piutang sampai lunas.
- Stok tidak boleh negatif: part kurang → `WAITING_PARTS` sampai stok masuk dicatat.

### 3.2 Stok

```
[Stok Masuk] pembelian (qty + harga beli + supplier)
      ├→ jumlah part bertambah
      └→ otomatis catat Kas Keluar (kantong BANK/TUNAI sesuai cara bayar) jika harga beli diisi
[Pakai di servis] otomatis stok keluar + SNAPSHOT harga beli saat itu (HPP per job)
[Penyesuaian] opname koreksi per part (wajib alasan); opname massal periodik: fase 2
[Peringatan] quantity ≤ minStock → banner "stok menipis" di dashboard
```

### 3.3 Kas & Piutang

- **Otomatis:** pemasukan dari setiap pembayaran servis (DP/pelunasan — tercatat ke **kantong** kas/bank sesuai metode); pengeluaran dari pembelian part.
- **Manual:** admin/owner mencatat kas masuk/keluar lain (sewa, gaji, listrik) + memilih **sumber dana** (Tunai / Bank).
- **Saldo tidak pernah diketik manual** — selalu hasil jumlah mutasi (prinsip buku kas yang bisa dipercaya).
- **Piutang:** daftar servis dengan sisa tagihan (belum lunas) + total piutang, urut tertua, lengkap dengan kontak customer — halaman khusus di menu Kas.
- Semua transaksi: jenis, kategori, nominal, kantong, cabang, pembuat, waktu — koreksi lewat transaksi baru (hapus dibatasi).

---

## 4. Fitur (FR)

### FR-0 Akun, sesi & peran — ✅ sudah ada (tambah SysAdmin)
- Register customer mandiri, login semua peran, sesi JWT, guard server-side per role, logout, nav adaptif per role.
- Peran: OWNER, CUSTOMER, ADMIN, MECHANIC → **tambah `SYS_ADMIN`** (migrasi Fase A).

### FR-1 Multi-cabang — **Rilis 1**
- Model **Cabang** (nama, alamat, telepon, jam operasional, aktif); owner & SysAdmin kelola; staff di-assign 1 cabang.
- Data ter-scope per cabang; pemilih cabang di halaman laporan/kas/stok/piutang/servis (default cabang pertama — owner ganti per halaman; agregat “Semua Cabang” → §7). Dashboard owner menampilkan agregat semua cabang.
- MVP jalan dengan 1 cabang aktif; struktur siap multi sejak awal.

### FR-2 Katalog jasa — **Rilis 1**
- Jenis jasa: nama, deskripsi, harga dasar, flag **boleh DP**; CRUD owner & SysAdmin (global; admin memakai saat booking & override harga per transaksi).

### FR-3 Booking & persetujuan estimasi — **Rilis 1**
**Customer:**
- Kelola kendaraan saya (plat unik, merek, tipe, tahun).
- Form booking: pilih cabang (jam operasional tampil) + kendaraan + jenis jasa/keluhan + jadwal → `PENDING`.
- Halaman Pesanan: status real-time; **tombol Setuju/Tolak estimasi** saat `WAITING_APPROVAL`; riwayat & tagihan.

**Admin:**
- Daftar booking masuk (filter status/tanggal); isi/ubah estimasi + jadwal + mekanik → kirim (`WAITING_APPROVAL`).
- **Booking manual (walk-in/telepon):** pencarian cepat **by plat** (kendaraan & customer otomatis ditemukan; bila belum ada, data baru diisi manual: nama/email/HP). Pencarian by nama/HP → §7.
- Approve di tempat (catatan “disetujui langsung”) → `CONFIRMED`; batalkan dengan alasan sebelum pengerjaan.

### FR-4 Penerimaan, papan kerja & proses servis — **Rilis 1**
- **Papan kerja admin:** servis aktif dikelompokkan per status (menunggu approval, dikonfirmasi, unit di tempat, dikerjakan, menunggu part, siap bayar) — satu layar antrian operasional.
- **Penerimaan unit (precheck):** saat unit datang, admin/mekanik isi pemeriksaan awal (km, BBM, kondisi existing, keluhan disepakati) → `CHECKED_IN`. Wajib terisi sebelum `IN_PROGRESS`.
- **Mekanik:** tugas saya; `IN_PROGRESS` (waktu mulai), diagnosis, catat part (dari stok cabang — keluar otomatis + snapshot HPP), biaya jasa, kerja selesai.
- **QC:** verifikasi admin/owner sebelum `DONE` (manual dulu; checklist digital fase 2) → `DONE` = siap diambil.
- Riwayat servis lengkap: alur status, estimasi & approval, precheck, diagnosis, part, biaya, pembayaran, durasi (waktu mulai–selesai), pelaku.

### FR-5 Pembayaran (lunas, DP, piutang) — **Rilis 1**
- Per servis: total, total dibayar, sisa tagihan. Pembayaran: nominal, metode (Tunai/QRIS/Transfer → kantong kas/bank), jenis (**DP**/**Pelunasan**), petugas, waktu.
- Lunas sekali; atau DP (jika `allowDp`) + pelunasan sisa; **atau serah terima dengan sisa → piutang** (FR-7).
- Status bayar otomatis: `BELUM` / `SEBAGIAN (Rp x, sisa Rp y)` / `LUNAS`.
- Setiap pembayaran → entri Kas otomatis di kantong yang benar (FR-7). Refund mengikuti kebijakan FR-10.

### FR-6 Stok part & supplier — **Rilis 1**
- **Master supplier** (nama, HP, catatan) — dicatat di setiap stok masuk.
- CRUD part per cabang: SKU unik per cabang, nama, kategori, satuan, qty, min. stok, harga beli & jual.
- Stok masuk (+qty, otomatis Kas Keluar dgn kantong sesuai cara bayar); keluar via servis; penyesuaian per part (wajib alasan).
- Riwayat pergerakan; banner stok menipis; nilai persediaan; **harga beli saat dipakai di-snapshot ke servis** (dasar laba per job).

### FR-7 Kas & piutang — **Rilis 1**
- Daftar transaksi: filter tanggal/kategori/jenis/kantong/cabang; ringkasan hari-ini & bulan-ini.
- Tambah manual + pilih **sumber dana** (Tunai/Bank); koreksi via transaksi baru.
- Kategori: entri manual **bebas teks** (mis. Operasional, Sewa, Gaji, Lain-lain); entri otomatis memakai label tetap — `Pembayaran Servis`/`DP Servis` (pembayaran servis) dan `Pembelian Part` (stok masuk).
- **Menu Piutang:** servis belum lunas → customer, kendaraan, tanggal DONE, sisa tagihan (urut tertua); total piutang; aksi cepat “catat pembayaran cicilan”.
- Entri otomatis: pembayaran servis & pembelian part (FR-5, FR-6).

### FR-8 Laporan owner & admin — **Rilis 1**
- Periode (Hari ini / Bulan ini / Rentang custom) + filter cabang.
- **Ringkasan:** omzet (kas masuk bayar), laba kotor (pendapatan − HPP ter-snapshot), jumlah servis selesai, saldo kas periode.
- **Rekap per kantong** (Tunai/Bank) + **rincian laba per servis**.
- **Export CSV** (ringkasan + detail kas per periode). Owner lintas cabang; Admin cabangnya.
- Belum ada → §7: laba bersih per kategori, rincian piutang di laporan, DP vs pelunasan, durasi rata-rata, tingkat persetujuan estimasi, performa mekanik, part terlaris.

### FR-9 PWA, mobile & cetak — **Rilis 1**
- Sudah ada: manifest, SW, ikon, bottom-nav; **responsif desktop (sidebar)**. Wajib: semua halaman nyaman di HP, format Rupiah & tanggal Indonesia, navigasi tanpa dead-end.
- **Cetak:** halaman **nota servis** siap cetak (print browser). Cetak estimasi & daftar piutang → §7.

### FR-10 Pengaturan sistem — **Rilis 1**
Akses: **Owner + SysAdmin**; perubahan tercatat (siapa, kapan).
- **Jam operasional per cabang** (hari aktif, jam buka/tutup) → tampil saat booking; patokan tindak lanjut admin.
- **Kebijakan DP & pembatalan:** `TANPA_REFUND` / `REFUND_PENUH` (MVP: panduan + eksekusi manual lewat kas; otomatis fase 2).
- **Parameter:** nama tampilan aplikasi, **logo** (URL), **prefix kode servis** (mis. `SV-`).
- **Kelola akun staff:** buat akun Admin/Mekanik/SysAdmin, assign cabang, reset password, nonaktifkan.
- **Backup data:** unduh salinan database (JSON export) — rutinitas SysAdmin.

---

## 5. Status & Aturan Penting

**Status servis:** `PENDING → WAITING_APPROVAL → CONFIRMED → CHECKED_IN → IN_PROGRESS ⇄ WAITING_PARTS → DONE`; `CANCELLED` dari PENDING/WAITING_APPROVAL/CONFIRMED/CHECKED_IN (wajib alasan). Hanya maju, kecuali `WAITING_PARTS → IN_PROGRESS`.

**Aturan kunci:**
- `CONFIRMED` = estimasi disetujui; `CHECKED_IN` = unit diterima + precheck terisi — keduanya gerbang wajib sebelum `IN_PROGRESS`.
- `DONE` hanya setelah kerja selesai **dan** cek akhir lolos.
- Pembayaran tidak menghalangi serah terima — sisa tagihan menjadi **piutang** yang terpantau.

**Status bayar (turunan):** `BELUM` (0), `SEBAGIAN` (0 < dibayar < total), `LUNAS` (dibayar ≥ total).

**Integritas data (wajib):**
- Stok tidak negatif; qty part di servis = stok keluar nyata; HPP part = snapshot saat dipakai.
- Kas dari pembayaran/pembelian dibuat dalam transaksi DB yang sama; saldo selalu hasil mutasi (tidak bisa diketik).
- Laporan hanya dari tabel transaksi (tidak ada angka manual terpisah).

---

## 6. Kebutuhan Non-Fungsional
- **Mobile-first:** target HP; diuji 360–430px; PWA installable; **responsif desktop** (sidebar md+, uji s.d. lebar xl).
- **Offline:** hanya halaman cache untuk dibaca; mutasi butuh koneksi.
- **Keamanan:** scrypt ✅; autorisasi server-side; query selalu ter-filter cabang/role.
- **Skala:** ratusan transaksi/hari/cabang — **Neon PostgreSQL** (production & staging via branch).
- **Deploy:** **Vercel** (app) + **Neon** (Postgres, branch `production` sebagai default; koneksi `sslmode=verify-full`).
- **Bahasa:** Indonesia; Rupiah (integer, format `Rp`).
- **Backup:** unduh DB tersedia (FR-10); Neon menyediakan **PITR** (point-in-time restore) sebagai backup otomatis.

---

## 7. Di Luar Cakupan (fase 2+, kecuali dinaikkan)
- **Purchasing:** PO & penerimaan berjenjang, retur pembelian, pembelian tempo → **hutang supplier**.
- **Opname massal periodik** (MVP: penyesuaian per part); laporan part lambat laku/matian.
- **Shift kasir + rekonsiliasi selisih kas fisik**; saldo awal akun; akun bank multi.
- Notifikasi WA/push (status booking, “siap diambil”, pengingat servis berikutnya, garansi jasa).
- QC digital (checklist + foto), foto precheck/DVI, tanda tangan approval digital.
- Approval estimasi **per-item** & change order di tengah pengerjaan; pekerjaan tertunda (declined → follow-up).
- Eksekusi refund DP otomatis; **diskon** per item/nota; **PPN/pajak**.
- Sublet (kerja keluar: spooring, cat, bubut); penjualan part over-the-counter (POS); transfer stok antar cabang; harga/katalog per cabang.
- Laporan lanjutan: laba bersih per kategori, rincian piutang di laporan, DP vs pelunasan, durasi rata-rata, tingkat persetujuan estimasi, performa mekanik, part terlaris; **cetak estimasi & daftar piutang**; opsi agregat “Semua Cabang”; pencarian customer by nama/HP.
- Grafik trend penjualan, aging piutang, komisi & payroll mekanik, absensi, CRM loyalitas/poin, slot jam booking, cetak via printer Bluetooth/thermal, multi-bahasa, SaaS, integrasi payment gateway, laporan akuntansi penuh (neraca/jurnal/PSAK).

---

## 8. Fase Pengembangan (Rilis 1)

| Fase | Isi | Keluaran |
|---|---|---|
| **A. Fondasi data & sistem** ✅ | Delta skema (App. A): Cabang+jam, katalog, supplier, SystemSetting, `SYS_ADMIN`, `WAITING_APPROVAL`, `CHECKED_IN`, `ServicePart.cost`, `Cashflow.account`; seed; halaman **Pengaturan**, **Kelola Akun**, **Backup** | Migrasi bersih; SysAdmin & konfigurasi aktif |
| **B. Servis end-to-end** ✅ | Katalog, booking + approval, **precheck/CHECKED_IN**, papan kerja, workspace mekanik, QC→DONE | Siklus booking→DONE (approve & precheck dulu) jalan |
| **C. Stok** ✅ | CRUD part + supplier, masuk/manual, keluar via servis + snapshot HPP, alert menipis | Stok & HPP akurat |
| **D. Bayar & Kas** ✅ | DP/lunas/piutang, kantong kas, entri kas otomatis & manual, menu Piutang | Keuangan utuh |
| **E. Laporan & polish** ✅ | Dashboard riil, laporan periode/cabang/mekanik/**laba per servis**/**per kantong**, export CSV, halaman cetak, PWA pass | Siap dipakai harian |

Setiap fase selesai = fitur terpasang + role-guard teruji + `build`/`lint` hijau + smoke test alur utama.

---

## 9. Kriteria Selesai & Sukses
**Rilis 1 dianggap selesai jika:**
1. Siklus penuh (booking → approve → precheck → servis → bayar/piutang → kas → laporan) berjalan tanpa intervensi manual di DB.
2. Owner membuka 1 layar laporan: angka kas = jumlah transaksi nyata, piutang & laba per servis terlihat (rekap 1 hari uji coba).
3. Seluruh alur utama terpakai nyaman dari HP (install PWA).

**Indikator awal:** stok tidak meleset setelah 2 minggu pemakaian; rekap harian owner < 1 menit; tidak ada nota piutang yang “lupa” (semua tampil terpusat).

---

## 10. Risiko & Keputusan Terbuka
| # | Item | Status |
|---|---|---|
| 1 | Kebijakan DP saat batal | ✅ konfigurasi (TANPA_REFUND/REFUND_PENUH); eksekusi manual di MVP |
| 2 | Harga jasa dinegosiasi | Admin override, tercatat di riwayat |
| 3 | Katalog jasa belum per-cabang | Global dulu; beda harga per cabang → fase 2 |
| 4 | Jam operasional | ✅ konfigurasi per cabang (FR-10) |
| 5 | Mekanik lihat laba? | ✅ ditegakkan (v1.1): menu Tugas + Beranda **tanpa angka keuangan** |
| 6 | Cakupan SysAdmin | ✅ **Disetujui** + guard ditegakkan (v1.1): Beranda (tanpa angka keuangan/stok) + katalog + akun + pengaturan + backup + kelola cabang; **operasional (servis/stok/kas/piutang/laporan) = OWNER/ADMIN** |
| 7 | Pengingat booking otomatis (SLA) | Fase 2 bersama notifikasi WA |
| 8 | Aturan penagihan piutang | ✅ **Disetujui**: diskresi admin + piutang terpantau; aturan keras → pengaturan rilis berikut |

---

## App. A — Delta skema (baseline pra-Rilis 1)

**Model baru:**
- `Branch` — id, nama, alamat, telepon, jamBuka, jamTutup, hariAktif (`"1,2,3,4,5,6"`), aktif
- `ServiceCatalog` — id, nama, deskripsi, hargaDasar, allowDp, aktif
- `Supplier` — id, nama, telepon, catatan, aktif
- `SystemSetting` — key (unik), value, updatedBy, updatedAt (kebijakan refund, nama tampilan, prefix kode, …)

**Perubahan enum:**
- `Role` + `SYS_ADMIN`
- `ServiceStatus` + `WAITING_APPROVAL`, `CHECKED_IN`
- `Cashflow.account` enum: `KAS` | `BANK` (kantong uang)

**Field baru / perubahan:**
- `User.branchId?` (staff; owner & SysAdmin null = lintas cabang)
- `Part.branchId` (stok per cabang; SKU unik per cabang), `Part.supplierId?`
- `StockMovement.supplierId?` + `StockMovement.cost?` (harga beli tercatat di mutasi masuk)
- `Service.branchId`, `Service.source` (`APP`|`ADMIN`), `Service.cancelReason?`
- `ServicePart.cost` — **snapshot harga beli saat part dipakai** (dasar HPP/laba per servis)
- `Payment.kind` (`DP`|`PELUNASAN`), `Payment.paidAt`, `Payment.method` → menentukan kantong kas tujuan
- `Cashflow.branchId`, `Cashflow.account` (`KAS`|`BANK`)
- (Opsional Fase E) `Service.catalogId?` untuk analitik jenis jasa

**Tidak berubah:** model User/Vehicle/StockMovement/ServicePart/Payment sudah sesuai struktur — hanya menambah scoping, enum, dan field di atas.
