# UI/UX Audit — RevGo Speed

> Tanggal: Okt 2026 · Lensa: mobile-first (bengkel motor, PWA) + tablet + desktop
> Metode: heatmap pointer (thumb-zone / Fitts's law), F-pattern, heuristik Nielsen, Hick's law, Miller chunking.
> Status: P0 = sedang/berjalan dieksekusi · P1/P2 menyusul.

---

## 1. Heatmap & aturan penempatan (3 breakpoint)

### Mobile (360–430px, satu tangan)
```
🔴 ATAS (0–20%)     Perhatian TINGGI · jempol SULIT (regrip)
                     → boleh: judul, info, menu  ·  JANGAN: aksi primer/submit
🟡 TENGAH (20–45%)   Perhatian tinggi · jempol sedang → konten baca, sekunder
🟢 BAWAH (45–85%)    Jempol penuh tanpa regrip ← AKSI PRIMER (sticky/FAB)
🟢▓ BOTTOM NAV ▓     Thumb gold → navigasi; alokasi maks 5–6 item
```

### Tablet (768–1024px, sentuh)
- Zona nyaman melebar ke tengah-bawah; target sentuh **≥44px** (`min-h-11`).
- Bottom-nav dipertahankan di potret; sidebar mulai efektif di landscape/`lg+`.

### Desktop (1280+, mouse/keyboard)
- **Kanan-atas = posisi CTA yang benar** (kebalikan aturan mobile) → PageHeader aksi kanan-atas ✓.
- Fitts's law: ukuran & jarak kursor; yang kritis: **hover affordance** & **focus-visible keyboard**.
- Kepadatan: data harus **tabel** (sort/banding), bukan kartu panjang; form lebar → 2 kolom/split.

### Verdict heatmap vs implementasi (awal audit)
| Layar | Posisi aksi primer | Zona | Status |
|---|---|---|---|
| Customer /pesanan | Kartu kendaraan (baca-manual) di atas, CTA booking di bawahnya, form tersembunyi toggle | 🔴 terbuang | ❌ → P0 |
| Servis detail | Aksi status di paling bawah setelah4 kartu; nav bawah non-sticky | ❌ scroll buta | ❌ → P0 |
| Papan servis | `+ Booking` pojok kanan atas; 9 pill filter | ⚠️ ok utk secondary | P1 (3 segmen + FAB) |
| Dashboard | Stat atas, CTA tengah | 🟡 ✓ | P1 (drill-down) |
| Piutang | Form bayar terulang tiap kartu | 🟡 rawan salah bayar | P1 (bottom-sheet) |
| Stok | 1 toggle →3 form menumpuk | 🟡 kognitif | P1 (tab-form) |
| Bottom nav | Owner kehilangan Piutang; non-sticky (hilang saat scroll) | 🟢 teralokasi salah | ❌ → P0 |

---

## 2. Analisis UI (visual consistency)

**Pertahankan:** pola kartu seragam `rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card`; token di `globals.css`; nav dinamis per role.

**Temuan:**
1. **H** — Label `text-slate-700/600` (mentah) di ~31 file, bukan token `foreground/muted-foreground`.
2. **H** — Tak ada token danger: `text-red-600` (33×) untuk void/cancel/sisa — harus `--color-danger`, terpisah dari brand `primary`.
3. **M** — Tak ada `hover:` (hanya sidebar) & **0 `focus-visible`** → desktop/keyboard tanpa affordance.
4. **M** — Tombol tanpa skala (`py-1.5/2/2.5` acak); spasi `space-y-3/4/5/6`; header halaman beda-beda (perlu `PageHeader`).
5. **M** — `<table>` hanya di Laporan & cetak — Piutang/Kas/Audit/Stok tetap kartu di desktop.
6. **L** — `Msg` di-copy 6+ file; empty state campur; AGENTS.md `max-w-lg` vs kode `max-w-6xl` (perlu sinkron).

## 3. Analisis UX (journey)

- **Customer:** form tersembunyi toggle (discoverability gagal) · status servis tanpa "langkah berikutnya" · booking 1 form panjang (abandon risk) · kendaraan di atas CTA (urutan kebalik) — *selesai via P0 + P1*.
- **Admin/Kasir:** aksi status = inti kerja tapi paling bawah · papan 9 pill (Hick) · `?booking=1` reset konteks · Piutang tanpa BranchPicker · form bayar berulang.
- **Mekanik:** `tugas` read-only total — semua aksi harus masuk detail.
- **Owner:** dashboard angka mati (tanpa drill-down) · Audit = JSON mentah · **katalog read-only** = operator tak bisa koreksi data sendiri (polos kematian journey, sama seperti keluhan kendaraan dulu).
- **Konfigurasi:** Pengaturan =4 form/4 simpan · Stok =3 form serentak · part form12 field tanpa grouping.
- **Mekanik chrome mobile:** header & bottom-nav **bukan sticky** → di halaman panjang nav hilang (harus scroll ke bawah untuk ganti menu).

## 4. Rancangan ulang (target)

### Skeleton halaman standar
```
PageHeader (judul + subtitle + aksi kanan=sekunder; sticky top utk mobile)
[Alert/banner/CTA status — zona 🔴]
Segment ≤3 + "Lainnya ▾"
List/kartu (🟡→🟢)
StickyActionBar 🟢 (opsional; lg:hidden) → #aksi
```

### Journey target (ringkas)
- **Customer:** Status servis AKTIF (next-step + CTA approve) → Booking CTA selalu terlihat → Kendaraan (sekunder) → Riwayat. Booking → 3 langkah.
- **Servis detail:** panel **"Langkah berikutnya"** tunggal (1 form aksi utama + "Aksi lainnya" collapse) + sticky bar "ke aksi" di zona hijau; `lg+` → right-rail (P2).
- **Papan:** 3 segmen (Berjalan/Menunggu/Selesai) + FAB `+` (P1).
- **Piutang:** bottom-sheet bayar tunggal + konfirmasi jumlah (P1).
- **Tugas mekanik:** aksi inline di kartu (P1).
- **Owner:** stat → drill-down; kartu "Anomali hari ini"; Audit tampilkan total (P1/P2).
- **Nav mobile:** `Beranda · Servis · Stok · Kas · Piutang · Laporan · Audit` (≤7 → `text-xs`), label seragam "Tugas Saya"; opsional `Lainnya ▾` sheet (P2).

### Kontrak responsif
| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Nav | bottom sticky `z-40` | bottom ≤1024 / sidebar `lg+` | sidebar `md+` |
| Aksi primer | sticky bar / dalam layar pertama | ≥44px target | PageHeader kanan-atas |
| Data | kartu | kartu/grid | **tabel `lg+`** |
| Form | 1 kolom | 1 kolom | 2 kolom/split |
| Feedback | Msg global + focus ring + hover ring | idem | idem |

## 5. Prioritas

**P0 (dieksekusi):**
1. `/pesanan`: urutan **Status aktif (next-step + approve) → CTA Booking → Kendaraan → Riwayat**.
2. Servis detail: panel aksi tunggal **"Langkah berikutnya"** + **sticky bar** ke `#aksi` (lg:hidden).
3. Nav mobile: **sticky bottom** + Piutang utk Owner/Admin + label seragam; header sticky.
4. Token: `--color-danger` + sweep `text-slate-700/600` → token, `text-red-600` → `text-danger` (+ smooth-scroll & reduced-motion).

**P1:** booking 3-langkah · papan 3-segmen + FAB · piutang bottom-sheet · tugas +aksi inline · stok tab-form · pengaturan 1-form · katalog edit/nonaktif · BranchPicker seragam · hover/focus global · tabel `lg+` · target sentuh 44px · dashboard drill-down.

**P2:** right-rail servis detail desktop · Audit total + paginasi (X dari Y) · komponen global `PageHeader/Msg/EmptyState` · skala tombol/spasi · `2xl` grid · sync AGENTS.md · nav `Lainnya ▾`.
