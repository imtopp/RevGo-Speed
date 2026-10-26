# PRD — RevGo Speed

**Versi:** 1.3 (Sinkronisasi PRD ↔ kode: POS part, refund kelebihan, HPP FIFO)
**Tanggal:** 26 Oktober 2026
**Status:** Rilis 1 selesai — semua fase A–E terpasang, siap produksi; Rilis 1.5 berjalan: FR-11 (audit) terpasang, FR-12 menyusul

**Riwayat:**
- v0.1 — draft awal (4 modul rilis 1, multi-cabang, DP+lunas).
- v0.2 — peran **System Administrator**; kebijakan DP/refund & jam operasional jadi **konfigurasi**; alur disesuaikan standar industri bengkel (approval estimasi, QC sebelum serah terima).
- v0.3 — evaluasi gap vs praktik software bengkel (riset komparatif): tambah status **`CHECKED_IN` + pemeriksaan awal unit**, papan kerja, master **supplier**, sumber dana kas (**kantong uang**), menu **piutang**, snapshot **HPP per servis** (laba per job), backup DB; daftar fase 2 diperkaya (opname massal, shift kasir, PO, dsb.).
- v1.0 — **rebrand RevLedger → RevGo Speed** (hostname & branding); migrasi SQLite → **Neon PostgreSQL**; deploy **Vercel** (production) + Neon (DB); semua fase A–E selesai.
- v1.1 — audit konsistensi PRD ↔ implementasi: keputusan cakupan SysAdmin (risiko #6) & angka keuangan mekanik (risiko #5) **ditegakkan di kode**; detail disesuaikan dengan kode aktual (`CANCELLED` + `CHECKED_IN`, kategori kas bebas teks + label otomatis, parameter pengaturan +logo, cakupan laporan/cetak/pencarian, piutang urut tertua + kontak); dukungan **desktop responsif**, **design system**, aset logo.
- v1.2 — **audit & anti-fraud (FR-11, terpasang):** AuditLog append-only (diff before→after, transaksi DB sama), **void pembayaran Owner-only** + reversal kas otomatis, halaman **Audit** (peringatan: void / jasa < katalog / part < jual / opname); semua Σ terbayar mengabaikan pembayaran void; auditLogs ikut backup. **FR-12 rekonsiliasi kas harian** & notifikasi event-driven (tanpa daemon Vercel) didefinisikan (fase 1.5).
- v1.3 — audit PRD ↔ kode (26 Okt): **penjualan part tanpa servis/POS** (`PartSale`) resmi masuk FR-6/8 (keluar dari daftar fase 2); **refund kelebihan bayar** owner-only (`PaymentKind REFUND`, FR-5); **HPP batch FIFO** (`PartBatchUsage` + koreksi `correctStockCost`) menggantikan narasi snapshot sederhana (FR-6); **booking walk-in tanpa akun customer** (FR-3); **ganti password wajib saat login pertama** + ganti password mandiri (FR-0); **aturan bayar ditahan** saat pengerjaan (FR-5); **selisih opname → beban/temuan** laporan (FR-8); **rate limit 2 lapis** (NFR). + **App. B** praktik implementasi (kualitas di atas minimum FR).
- v1.4 — **stok awal part = belanja (26 Okt):** membuat part dengan qty > 0 & harga beli > 0 otomatis catat **Kas Keluar** atomik (kantong sesuai cara bayar, FR-6/§3.2) — modal tertahan di barang ikut terbaca di saldo & laporan; koreksi harga batch stok awal otomatis ikut menggeser kas (deteksi via baris `Pembelian Part`). **Barang consignment/konsinyasi** tercatat di §7 (fase 2+). + **Hapus part guard ketat** (hanya part tanpa riwayat; AuditLog `PART_DELETE`), **SKU auto** `PART-0001` saat dikosongkan (FR-6), **cari/filter/hitungan daftar part** (FR-6).

---

## 1. Ringkasan Produk

**Masalah.** Bengkel kecil-menengah mengelola booking, stok part, dan arus kas lewat buku catatan/WhatsApp/Excel — data tercecer, stok sering meleset, piutang tidak terpantau, dan pemilik tidak punya gambaran keuangan harian.

**Solusi.** RevGo Speed adalah aplikasi web (PWA, mobile-first) yang mengelola operasional bengkel motor terpadu: booking & proses servis, inventori suku cadang, pencatatan kas & piutang, dan laporan pemilik — dengan akses berbasis peran (owner, system administrator, admin, mekanik, customer). Bersifat **white-label**: nama & logo yang tampil ke customer dikonfigurasi System Administrator per bengkel (mis. "TBRT"), sehingga platform yang sama bisa dipakai banyak bengkel dengan identitas masing-masing.

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
| **Audit & void pembayaran** | ✔ (khusus) | – | – | – | – |
| **Rekonsiliasi kas harian (FR-12)** | ✔ (review) | – | ✔ (hitung) | – | – |
| Data sendiri (kendaraan, riwayat) | – | – | – | – | ✔ |

**Scoping cabang:** owner & system administrator lintas cabang; admin & mekanik terikat 1 cabang; customer lintas cabang.

**Menu adaptif:** Owner: seluruh menu termasuk **Audit**; SysAdmin: **Beranda** (tanpa angka keuangan/stok), **Katalog, Akun, Pengaturan, Backup**; Admin: **operasional + piutang**; Mekanik: **Beranda** (tanpa angka keuangan) + **Tugas Saya**.

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
- **Booking berbasis slot kedatangan** (per cabang): customer **wajib** pilih jadwal pada grid per jam dalam `jamBuka`–`jamTutup` hari aktif — booking di luar jam/hari operasional, melewati horizon, atau saat kuota pit penuh **ditolak + alternatif slot ditampilkan**. Slot `T` tersedia bila jumlah servis aktif dengan window `[jadwal, +estimasi durasi + buffer)` menutupi `T` < `kuotaParalel` cabang (default 2 pit). Lead time default 2 jam & horizon default 14 hari diatur di **Pengaturan → Booking & Slot**; buffer antar unit default 15 menit. **Reservasi admin** (telepon) aturannya sama **tanpa lead time**; **walk-in tanpa jadwal tidak pernah ditolak** — kedatangan dicatat = sekarang, slot berikutnya otomatis diblokir sesuai durasi (peringatan bila melebihi kuota). Tampilan selalu menyatakan waktu yang dipilih = **jam kedatangan**, bukan janji jam selesai.
- **Tidak ada pengerjaan tanpa persetujuan estimasi** (gerbang `CONFIRMED`) **dan tanpa precheck** (gerbang `CHECKED_IN → IN_PROGRESS`).
- Pemeriksaan awal (`CHECKED_IN`): km/odometer, level BBM (opsional), **kondisi yang sudah ada** (goresan/penyok — teks), keluhan disepakati (prefill booking), waktu terima otomatis. Bukti kondisi awal → acuan serah terima.
- Kerja tambahan di tengah pengerjaan: konfirmasi WA/telepon dulu, lalu update estimasi (approval per-item: fase 2).
- Total tagihan = Σ(part terpakai × harga jual) + biaya jasa. Biaya jasa bisa diubah admin (default katalog; negosiasi tercatat).
- DP hanya jika jenis jasa `allowDp`; kebijakan refund mengikuti Pengaturan sistem (FR-10). **Pembayaran ditahan saat servis berjalan** — DP saat booking, pelunasan hanya setelah QC lolos (`DONE`) (FR-5).
- **Piutang:** unit **boleh diserahkan dengan sisa tagihan** (discretion admin) → sisa tercatat & tampil di menu Piutang sampai lunas.
- Stok tidak boleh negatif: part kurang → `WAITING_PARTS` sampai stok masuk dicatat.

### 3.2 Stok

```
[Stok Masuk] pembelian (qty + harga beli + supplier)
      ├→ jumlah part bertambah
      └→ otomatis catat Kas Keluar (kantong BANK/TUNAI sesuai cara bayar) jika harga beli diisi
[Stok awal part] qty > 0 + harga beli saat bikin part → otomatis catat Kas Keluar (kantong sesuai cara bayar) — modal tertahan di barang
[Pakai di servis] otomatis stok keluar + alokasi batch FIFO (HPP per job)
[Jual part tanpa servis (POS)] stok keluar FIFO atomik + kas masuk (harga jual dari data part)
[Penyesuaian] opname koreksi per part (wajib alasan); selisih → beban/temuan laporan; opname massal periodik: fase 2
[Peringatan] quantity ≤ minStock → kartu "stok menipis" di dashboard
```

### 3.3 Kas & Piutang

- **Otomatis:** pemasukan dari setiap pembayaran servis (DP/pelunasan — tercatat ke **kantong** kas/bank sesuai metode); pengeluaran dari pembelian part.
- **Manual:** admin/owner mencatat kas masuk/keluar lain (sewa, gaji, listrik) + memilih **sumber dana** (Tunai / Bank).
- **Saldo tidak pernah diketik manual** — selalu hasil jumlah mutasi (prinsip buku kas yang bisa dipercaya).
- **Piutang:** daftar servis dengan sisa tagihan (belum lunas) + total piutang, urut tertua, lengkap dengan kontak customer — halaman khusus di menu Kas.
- Semua transaksi: jenis, kategori, nominal, kantong, cabang, pembuat, waktu — **append-only** (tanpa ubah/hapus diam-diam): koreksi kas = **transaksi baru** (entri penyesuaian/reversal); koreksi pembayaran = **void ber-alaran oleh Owner** (reversal kas otomatis, FR-11) atau **refund kelebihan bayar** (owner-only, FR-5). Setiap aksi kritikal tercatat di **AuditLog** (pelaku, waktu, diff before→after) — lihat FR-11.

---

## 4. Fitur (FR)

### FR-0 Akun, sesi & peran — ✅ sudah ada (tambah SysAdmin)
- Register customer mandiri, login semua peran, sesi JWT, guard server-side per role, logout, nav adaptif per role.
- Peran: OWNER, CUSTOMER, ADMIN, MECHANIC → **tambah `SYS_ADMIN`** (migrasi Fase A).
- **Ganti password wajib saat login pertama** (proxy redirect ke `/ganti-password`) + halaman ganti password mandiri untuk semua peran.
- Akun customer **opsional** untuk booking (lihat FR-3 — walk-in tanpa akun).

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
- **Booking manual (walk-in/telepon):** pencarian cepat **by plat** — **tanpa wajib akun customer**: bila kendaraan/customer belum ada, data baru diisi manual (nama + HP disimpan sebagai snapshot di kendaraan/servis; `email`/`passwordHash` opsional). Validasi live format plat nomor (border merah + pesan, tombol nonaktif saat salah). Pencarian by nama/HP → §7.
- **Isi estimasi:** pilih jenis jasa → harga katalog terisi otomatis (bisa dinegosiasi, tercatat); **Setujui di Tempat** ditolak bila biaya jasa Rp0. Jadwal diubah terpisah dari form estimasi (peringatan bila estimasi sudah dikirim). Ganti mekanik kapan saja — pilihan difilter agar tidak bentrok jadwal.
- Approve di tempat (catatan “disetujui langsung”) → `CONFIRMED`; batalkan dengan alasan sebelum pengerjaan.

### FR-4 Penerimaan, papan kerja & proses servis — **Rilis 1**
- **Papan kerja admin:** servis aktif dikelompokkan per status (menunggu approval, dikonfirmasi, unit di tempat, dikerjakan, menunggu part, siap bayar) — satu layar antrian operasional.
- **Penerimaan unit (precheck):** saat unit datang, admin/mekanik isi pemeriksaan awal (km, BBM, kondisi existing, keluhan disepakati) → `CHECKED_IN`. Wajib terisi sebelum `IN_PROGRESS`.
- **Mekanik:** tugas saya; `IN_PROGRESS` (waktu mulai), diagnosis, catat part (dari stok cabang — keluar otomatis + snapshot HPP), biaya jasa, kerja selesai.
- **QC:** verifikasi admin/owner sebelum `DONE` (manual dulu; checklist digital fase 2) → `DONE` = siap diambil. QC berjalan **berurutan setelah kerja selesai**.
- **Koreksi input:** hapus part terpakai (stok kembali utuh) — khusus **Owner/Admin**; mekanik hanya melihat jejak. Semua perubahan tercatat di AuditLog.
- Riwayat servis lengkap: alur status, estimasi & approval, precheck, diagnosis, part, biaya, pembayaran, durasi (waktu mulai–selesai), pelaku.

### FR-5 Pembayaran (lunas, DP, piutang) — **Rilis 1**
- Per servis: total, total dibayar, sisa tagihan. Pembayaran: nominal, metode (Tunai/QRIS/Transfer → kantong kas/bank), jenis (**DP**/**Pelunasan**), petugas, waktu.
- Lunas sekali; atau DP (jika `allowDp`) + pelunasan sisa; **atau serah terima dengan sisa → piutang** (FR-7).
- **Aturan bayar ditahan:** DP hanya saat booking; pelunasan setelah servis **selesai** (QC lolos → `DONE`) — saat `IN_PROGRESS`/`WAITING_PARTS` pembayaran ditahan (pesan di UI & guard server-side).
- Status bayar otomatis: `BELUM` / `SEBAGIAN (Rp x, sisa Rp y)` / `LUNAS`.
- Setiap pembayaran → entri Kas otomatis di kantong yang benar (FR-7). Refund mengikuti kebijakan FR-10.
- **Refund kelebihan bayar (khusus Owner):** bila total terbayar > tagihan, Owner mengembalikan kelebihan — baris `Payment` negatif (`kind = REFUND`) + kas `EXPENSE` dalam 1 transaksi; ikut AuditLog & semua Σ terbayar; baris refund tidak bisa di-void.

### FR-6 Stok part & supplier — **Rilis 1**
- **Master supplier** (nama, HP, catatan) — dicatat di setiap stok masuk.
- CRUD part per cabang: SKU unik per cabang, nama, kategori, satuan, qty, min. stok, harga beli & jual. **SKU dikosongkan → auto urut per cabang** (`PART-0001`, mengisi bolong); SKU manual tetap boleh, dicek unik, dan **tidak bisa diubah** setelah part dibuat.
- **Hapus part (guard ketat):** hanya part yang **belum punya riwayat** (gerakan stok / dipakai servis / penjualan); part ber-riwayat dikoreksi via **Opname** (selisih → beban/temuan) atau **Ubah** — supaya cashflow & HPP tidak terganggu. Setiap hapus tercatat di AuditLog.
- **Daftar part:** pencarian (nama/SKU/kategori) + filter kategori + hitungan hasil — tidak perlu scroll.
- **Stok awal saat membuat part** (qty > 0 & harga beli > 0) = pembelian → otomatis **Kas Keluar** dalam transaksi yang sama (kantong sesuai cara bayar); qty 0 atau harga beli 0 tanpa kas. Pesan sukses menyebut konsekuensi kasnya.
- Stok masuk (+qty, otomatis Kas Keluar dgn kantong sesuai cara bayar); keluar via servis; penyesuaian per part (wajib alasan).
- **HPP batch (FIFO):** setiap stok masuk membentuk **batch** (`PartBatchUsage`) — harga pakai **rata-rata tertimbang**; unit terpakai dialokasikan FIFO dari batch terkait; `ServicePart.cost` = campuran batch unit tersebut (dasar laba per job). **Koreksi harga beli batch** terbatas pada unit terpakai dari batch terkait (`correctStockCost`) — merambat ke HPP servis & `PartSaleItem`; harga jual tidak berubah.
- **Penjualan part tanpa servis (POS/OTC):** jual langsung dari tab Jual — stok keluar + alokasi FIFO **atomik**, kas `INCOME` otomatis, harga jual dari data part (input kasir dibuang), riwayat penjualan + laba per penjualan, ikut laporan & CSV. Harga jual di bawah harga beli wajib konfirmasi.
- Riwayat pergerakan; kartu stok menipis; nilai persediaan; **harga beli saat dipakai di-snapshot ke servis** (dasar laba per job).

### FR-7 Kas & piutang — **Rilis 1**
- Daftar transaksi (100 terakhir) dengan **filter cabang** + **ringkasan saldo per kantong** (Kas & Bank); filter tanggal/kategori/jenis & ringkasan harian/bulanan → §7.
- Tambah manual + pilih **sumber dana** (Tunai/Bank); koreksi via transaksi baru.
- Kategori: entri manual **bebas teks** (mis. Operasional, Sewa, Gaji, Lain-lain); entri otomatis memakai label tetap — `Pembayaran Servis`/`DP Servis` (pembayaran servis) dan `Pembelian Part` (stok masuk & stok awal part).
- **Menu Piutang:** servis belum lunas → customer, kendaraan, tanggal DONE, sisa tagihan (urut tertua); total piutang; aksi cepat “catat pembayaran cicilan”.
- Entri otomatis: pembayaran servis & pembelian part (FR-5, FR-6); penjualan part (POS) masuk kantong sesuai metode.

### FR-8 Laporan owner & admin — **Rilis 1**
- Periode (Hari ini / Bulan ini / Rentang custom) + filter cabang.
- **Ringkasan:** omzet (kas masuk bayar servis), **penjualan part (tanpa servis) + labanya** (baris terpisah dari omzet servis), laba kotor (pendapatan − HPP ter-snapshot), jumlah servis selesai, saldo kas periode. Filter omzet per-cabang mengikuti cabang pembayaran (termasuk pembayaran tanpa servis).
- **Rekap per kantong** (Tunai/Bank) + **rincian laba per servis**.
- **Selisih opname** masuk sebagai beban/temuan pada laba periode.
- **Export CSV** (ringkasan + detail kas per periode + penjualan part). Owner lintas cabang; Admin cabangnya.
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

### FR-11 Audit & anti-fraud — **Rilis 1.5 (terpasang)**
Akses: **Owner** (halaman Audit & void); log ditulis otomatis untuk semua peran.
- **AuditLog append-only:** setiap aksi kritikal dicatat **dalam transaksi DB yang sama** dengan aksinya (aksi sukses ⇔ log ada — tidak ada log yatim, jejak tidak bisa hilang diam-diam). Isi: pelaku (id, nama, peran), aksi, entitas, cabang, ringkasan, **diff before→after (JSONB)**, waktu. Tanpa UI ubah/hapus; ikut ter-backup (FR-10).
- **Aksi yang dicatat:** pembayaran (buat/void/**refund kelebihan**), penjualan part (POS), kas manual, stok masuk (beli), penyesuaian stok, ubah harga part, **koreksi harga beli batch (HPP)**, servis (buat + **setiap transisi status** termasuk alasan batal), part servis (tambah/kembali), ubah pengaturan & cabang, kelola akun (buat/reset password/nonaktif/assign). Password **tidak pernah** masuk log.
- **Void pembayaran (khusus Owner):** alasan wajib (min. 4 karakter); menandai `voidedAt`/`voidReason`/`voidedBy` **+ membuat entri kas reversal** (EXPENSE, kategori `Pembatalan Bayar`) dalam **1 transaksi DB**; semua Σ terbayar/laporan/cetak **mengabaikan** pembayaran void; baris void tetap tampil (coret + alasan) di detail servis & Audit.
- **Halaman Audit (Owner):** kartu peringatan — pembayaran void, **jasa < harga katalog**, **part < harga jual**, stok disesuaikan — plus daftar log (filter per aksi, detail diff before→after).
- **Kriteria:** owner bisa menelusuri "siapa, kapan, apa" untuk semua aksi uang dalam < 1 menit.

### FR-12 Rekonsiliasi kas harian — **Rilis 1.5 (menyusul)**
Akses: Admin/Owner (input hitung), Owner (review).
- Saat tutup toko, petugas **mengetik saldo fisik** per kantong (KAS/BANK); sistem membandingkan dengan Σ mutasi — **saldo sistem tidak pernah diubah** oleh proses ini (tetap hasil mutasi).
- Selisih wajib diberi alasan; selisih tercatat sebagai **temuan** (punya jejak, bukan angka suntingan) dan ditampilkan di halaman Audit.
- Tujuan: kebocoran/pembukuan salah ketahuan dalam hitungan jam, bukan akhir bulan.

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
- Aksi uang & perubahan kritikal tercatat di **AuditLog** (append-only, FR-11); pembayaran hanya bisa di-**void Owner** (alaran wajib) + reversal kas otomatis.
- Laporan hanya dari tabel transaksi (tidak ada angka manual terpisah).

---

## 6. Kebutuhan Non-Fungsional
- **Mobile-first:** target HP; diuji 360–430px; PWA installable; **responsif desktop** (sidebar md+, uji s.d. lebar xl).
- **Offline:** hanya halaman cache untuk dibaca; mutasi butuh koneksi.
- **Keamanan:** scrypt ✅; **rate limit 2 lapis** (login & aksi berisiko, `RateLimitBucket`); autorisasi server-side; query selalu ter-filter cabang/role; **jejak audit append-only** (FR-11) untuk aksi uang & perubahan kritikal.
- **Skala:** ratusan transaksi/hari/cabang — **Neon PostgreSQL** (production & staging via branch).
- **Deploy:** **Vercel** (app) + **Neon** (Postgres, branch `production` sebagai default; koneksi `sslmode=verify-full`).
- **Bahasa:** Indonesia; Rupiah (integer, format `Rp`).
- **Backup:** unduh DB tersedia (FR-10); Neon menyediakan **PITR** (point-in-time restore) sebagai backup otomatis.

---

## 7. Di Luar Cakupan (fase 2+, kecuali dinaikkan)
- **Purchasing:** PO & penerimaan berjenjang, retur pembelian, pembelian tempo → **hutang supplier**.
- **Barang consignment / konsinyasi** (stok titipan supplier): kepemilikan & risiko tetap di supplier — stok masuk **tanpa** Kas Keluar, kas keluar baru saat pelunasan/tempo ke supplier. Butuh penanda per part + alur jual/utang terpisah dari pembelian biasa.
- **Opname massal periodik** (MVP: penyesuaian per part); laporan part lambat laku/matian.
- **Shift kasir**; saldo awal akun; akun bank multi. *(Rekonsiliasi selisih kas fisik dinaikkan → FR-12.)*
- **Notifikasi event-driven** — mekanisme: dikirim **dari dalam server action** setelah commit (kas manual/void/opname besar) via outbound Telegram Bot / WA Business Cloud API / email; rekap terjadwal via **Vercel Cron** (`vercel.json`) — **tanpa service latar belakang** (Vercel serverless tak punya daemon). Notifikasi = best-effort; **AuditLog tetap sumber kebenaran**. Konten menyusul: status booking, “siap diambil”, pengingat servis berikutnya, garansi jasa.
- QC digital (checklist + foto), foto precheck/DVI, tanda tangan approval digital.
- Approval estimasi **per-item** & change order di tengah pengerjaan; pekerjaan tertunda (declined → follow-up).
- Eksekusi refund DP otomatis; **diskon** per item/nota; **PPN/pajak**.
- Sublet (kerja keluar: spooring, cat, bubut); transfer stok antar cabang; harga/katalog per cabang.
- Laporan lanjutan: laba bersih per kategori, rincian piutang di laporan, DP vs pelunasan, durasi rata-rata, tingkat persetujuan estimasi, performa mekanik, part terlaris; **cetak estimasi & daftar piutang**; opsi agregat “Semua Cabang”; pencarian customer by nama/HP; filter transaksi kas (tanggal/kategori/jenis/kantong) & ringkasan harian/bulanan.
- Grafik trend penjualan, aging piutang, komisi & payroll mekanik, absensi, CRM loyalitas/poin, cetak via printer Bluetooth/thermal, multi-bahasa, SaaS, integrasi payment gateway, laporan akuntansi penuh (neraca/jurnal/PSAK).

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

**Rilis 1.5 (berjalan):** FR-11 audit & anti-fraud ✓ terpasang + E2E teruji; **POS penjualan part** & **refund kelebihan bayar** terpasang (v1.3); FR-12 rekonsiliasi kas harian (menyusul); notifikasi event-driven (fase 2, mekanisme terdefinisi).

---

## 9. Kriteria Selesai & Sukses
**Rilis 1 dianggap selesai jika:**
1. Siklus penuh (booking → approve → precheck → servis → bayar/piutang → kas → laporan) berjalan tanpa intervensi manual di DB.
2. Owner membuka 1 layar laporan: angka kas = jumlah transaksi nyata, piutang & laba per servis terlihat (rekap 1 hari uji coba).
3. Seluruh alur utama terpakai nyaman dari HP (install PWA).

**Indikator awal:** stok tidak meleset setelah 2 minggu pemakaian; rekap harian owner < 1 menit; tidak ada nota piutang yang “lupa” (semua tampil terpusat).

**Rilis 1.5 dianggap selesai jika:**
1. Semua aksi uang (bayar/void/kas manual/beli part/opname) & transisi servis punya baris AuditLog dengan pelaku + diff (FR-11).
2. Void pembayaran teruji end-to-end: reversal kas otomatis, total terbayar/piutang ikut terkoreksi, admin ditolak akses void.
3. FR-12: hitung kas harian jalan, selisih wajib alasan, tampil sebagai temuan di Audit.

---

## 10. Risiko & Keputusan Terbuka
| # | Item | Status |
|---|---|---|
| 1 | Kebijakan DP saat batal | ✅ konfigurasi (TANPA_REFUND/REFUND_PENUH); eksekusi manual di MVP |
| 2 | Harga jasa dinegosiasi | Admin override, tercatat di riwayat **+ diflag di Audit bila < katalog (FR-11, v1.2)** |
| 3 | Katalog jasa belum per-cabang | Global dulu; beda harga per cabang → fase 2 |
| 4 | Jam operasional | ✅ konfigurasi per cabang (FR-10) |
| 5 | Mekanik lihat laba? | ✅ ditegakkan (v1.1): menu Tugas + Beranda **tanpa angka keuangan** |
| 6 | Cakupan SysAdmin | ✅ **Disetujui** + guard ditegakkan (v1.1): Beranda (tanpa angka keuangan/stok) + katalog + akun + pengaturan + backup + kelola cabang; **operasional (servis/stok/kas/piutang/laporan) = OWNER/ADMIN** |
| 7 | Pengingat booking otomatis (SLA) | Fase 2 bersama notifikasi — mekanisme event-driven + cron sudah didefinisikan (v1.2) |
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

---

## App. B — Praktik implementasi (kualitas di atas minimum FR) — v1.3

Bagian ini mendokumentasikan perilaku nyata di kode yang **melampaui ketentuan minimum** §4 — bukan fitur baru, melainkan *cara* fitur lama dieksekusi agar lebih efisien, ramah-pengguna, dan aman. Dipertahankan sebagai standar saat menambah fitur berikutnya.

### Booking & slot (FR-3) — cegah error, bukan tangani error
- Slot/tanggal **sudah `disabled` sejak awal** (tutup/penuh/lewat/lead-time) dengan alasan tooltip — user **tidak bisa memilih slot yang pasti ditolak**; PRD hanya mensyaratkan "ditolak + alternatif".
- Fetch ketersediaan **dua tahap** (tanggal dulu, slot saat dipilih) + auto-pilih tanggal pertama kosong + `Cache-Control: no-store`; alternatif penolakan **dikelompokkan per tanggal** dan tampil inline di form.
- Booking dibuat dalam transaksi + **`pg_advisory_xact_lock` per cabang+tanggal** (anti double-booking paralel — di luar PRD).
- Validasi plat live saat mengetik; datalist tipe difilter menurut merek + cek silang server ("X bukan tipe merek Y"); estimasi & durasi auto-isi dari katalog.
- Tombol Setuju/Tolak tampil di kartu aktif **dan** riwayat; reject otomatis mengisi `cancelReason`; penjelasan "langkah berikutnya" per status di kartu.

### Papan kerja & navigasi (FR-4)
- 9 tab filter status via URL dengan **guard enum** (parameter asing ditolak sebelum masuk query); **`PendingLink`** memberi spinner "Memuat…" agar ganti filter tidak terasa aplikasi hang; state form booking dipertahankan antar filter; empty state per filter.

### Proses servis & QC (FR-4)
- QC **berurutan dua lapis**: mekanik harus `finishedAt` dulu (client + server); mekanik tak melihat tombol QC — panel "Menunggu QC admin".
- Prefill keluhan booking di precheck & diagnosis; timestamp terima otomatis; ganti mekanik **anti-bentrok dua lapis** (UI hanya menawarkan mekanik bebas + server `validasiMekanik`); jadwal terpisah dengan recheck kapasitas ber-lock.
- Hapus part terpakai: **Owner/Admin saja** (mekanik memegang part fisik), restock atomik + audit; guard servis belum DONE/CANCELLED.
- Sticky action bar mobile + label aksi berikutnya per status; panel "Aksi lainnya" collapsible agar user tak tenggelam form.

### Pembayaran (FR-5)
- **"Sisa Rp X" live** di header form; form sembunyi otomatis saat lunas; server tolak overpay dengan pesan bersisa; hasil sukses **"Lunas!" / "Terima N. Sisa M."** — posisi tagihan selalu terlihat tanpa reload.
- Anti-paralel: `SELECT … FOR UPDATE` + recheck agregat sebelum insert; refund kelebihan **angka dihitung dari DB** (bukan input user).
- Guard "pembayaran ditahan" dieksekusi di **UI dan server** dengan pesan yang menjelaskan alasan + solusi.

### Stok & POS (FR-6)
- **PartPicker**: pencarian multi-token (nama/SKU/kategori, ranking), **Enter = pilih + submit**, auto-pick single match saat blur, hasil stok habis ditandai `HABIS` & disabled, cap 50 baris.
- **NumberInput**: format ribuan live (`150.000`) dengan hidden input digit murni untuk server; mode negatif khusus opname; unit test sendiri.
- Harga jual **read-only dari data part** (kasir tidak bisa mengetik harga); live total preview; harga di bawah beli → peringatan amber **live** + checkbox konfirmasi + cek server.
- Kategori: datalist saran lintas cabang + **normalisasi anti-typo di server** (merge case-insensitive).
- Anti-race stok: decrement via `updateMany({ quantity: { gte } })` + `FOR UPDATE` — stok mustahil negatif meski request paralel; stok awal part langsung jadi batch FIFO pertama.
- Pesan sukses menyebut konsekuensi: "Kas keluar X (KAS/BANK)", ringkasan efek koreksi HPP.

### Kas & piutang (FR-7)
- Kartu saldo per kantong dihitung dari **seluruh riwayat** (`groupBy`), bukan 100 baris yang ditampilkan — daftar ringkas, angka tetap akurat.
- Aksi cepat cicilan **inline di kartu piutang** (tak perlu pindah halaman), hanya muncul bila status menerima bayar; empty state "Semua lunas".

### Laporan (FR-8)
- **Export CSV 3 bagian**: servis (kode + TOTAL + SELISIH OPNAME + **LABA BERSIH**), penjualan part, arus kas — lengkap dengan **guard formula-injection Excel** (sel `= + - @` diprefiks `'`).
- Selisih opname tampil sebagai baris rupiah "beban/temuan"; tabel laba per servis per baris + link detail; parameter tanggal divalidasi ketat.

### Pengaturan & branding (FR-10)
- Parameter booking & slot (lead time, horizon, buffer, kuota pit per cabang) tervalidasi rentang; server menolak key di luar allowlist + **sanitasi URL logo dua lapis** (tolak skema selain `https:`/`/`); duplikat nama cabang dicek.
- Branding **merambat**: manifest/PWA, metadata browser, login/register, cetak nota, sampai nama file backup — bukan hanya header.

### Audit (FR-11)
- Chip filter aksi (pill, divalidasi enum — parameter asing diabaikan), diff before→after collapsible, kartu peringatan berincian (kode servis, plat, nominal, alasan) + sisa "…N lagi".

### Pola UX lintas modul (standar, di luar FR)
- **Auto-close form sukses + flash notif otomatis hilang** (katalog, akun, kas manual, cabang, stok, customer) — error → form tetap terbuka.
- Spinner `SubmitButton` di semua aksi server, `PendingLink` untuk ganti-query, **skeleton meniru layout nyata** per halaman, empty state mengarahkan aksi berikutnya.
- Format Rupiah/tanggal Indonesia dari satu modul util; angka moneter selalu **integer**; badge warna status dari token tunggal `STATUS_COLOR`.
