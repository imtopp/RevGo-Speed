import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { getAppName } from "@/lib/branding";
import Link from "next/link";

export const metadata = { title: "Backup" };

export default async function BackupPage() {
  await requireOwnerOrSysAdmin();
  const appName = await getAppName();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Backup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadangan data &amp; informasi pemulihan
        </p>
      </div>

      <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">
          Backup Otomatis (Neon)
        </h2>
        <p className="text-sm text-muted-foreground">
          Database {appName} berjalan di <strong>Neon Postgres</strong>. Neon
          menyimpan backup otomatis harian dengan retensi beberapa hari serta
          mendukung <em>point-in-time restore</em> (PILIH titik waktu untuk
          memulihkan). Kamu tidak perlu menjalankan backup manual untuk
          keamanan dasar.
        </p>
        <p className="text-sm text-muted-foreground">
          Pengaturan backup &amp; restore ada di dashboard Neon → project →{" "}
          <span className="font-medium">Restore</span>.
        </p>
        <a
          href="https://console.neon.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-foreground active:opacity-90"
        >
          Buka Neon Console ↗
        </a>
      </section>

      <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">
          Export Data Manual (JSON)
        </h2>
        <p className="text-sm text-muted-foreground">
          Unduh salinan seluruh data aplikasi (user, cabang, part, servis,
          pembayaran, kas, pengaturan) dalam format JSON. Berguna untuk arsip
          mandiri atau migrasi.
        </p>
        <Link
          href="/api/backup/export"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90"
        >
          Unduh Backup JSON
        </Link>
        <p className="text-xs text-slate-400">
          Catatan: file export memuat data sensitif (termasuk hash password).
          Simpan di tempat aman dan jangan bagikan sembarangan.
        </p>
      </section>
    </div>
  );
}
