import { prisma } from "@/lib/prisma";
import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { SettingForm } from "./setting-form";
import { BranchManager } from "./branch-manager";
import Link from "next/link";

export const metadata = { title: "Pengaturan" };

const SETTING_FIELDS = [
  { key: "app_name", label: "Nama Aplikasi", placeholder: "Nama bengkel (tampil ke customer), mis. TBRT" },
  { key: "logo_url", label: "Logo (URL gambar)", placeholder: "https://.../logo-bengkel.png" },
  {
    key: "dp_policy",
    label: "Kebijakan Refund DP",
    placeholder: "TANPA_REFUND atau REFUND_PENUH",
  },
  {
    key: "service_code_prefix",
    label: "Prefix Kode Servis",
    placeholder: "SV-",
  },
];

const BOOKING_FIELDS = [
  {
    key: "booking_lead_minutes",
    label: "Lead Time Booking (menit)",
    placeholder: "120 — minimal pesan 2 jam sebelum kedatangan (0 = bebas)",
  },
  {
    key: "booking_horizon_days",
    label: "Booking Maks (hari ke depan)",
    placeholder: "14",
  },
  {
    key: "booking_buffer_minutes",
    label: "Buffer Antar Jadwal (menit)",
    placeholder: "15 — jeda persiapan antar unit",
  },
];

export default async function PengaturanPage() {
  await requireOwnerOrSysAdmin();

  const [settings, branches] = await Promise.all([
    prisma.systemSetting.findMany(),
    prisma.branch.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Konfigurasi sistem &amp; kelola cabang
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Umum</h2>
        <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          {SETTING_FIELDS.map((field) => (
            <SettingForm
              key={field.key}
              field={field}
              initialValue={settingMap.get(field.key) ?? ""}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Booking &amp; Slot</h2>
        <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-xs text-muted-foreground">
            Atur ketersediaan slot kedatangan customer (lead time, jauhnya booking, jeda
            antar unit). Kuota pit diatur per cabang di bawah.
          </p>
          {BOOKING_FIELDS.map((field) => (
            <SettingForm
              key={field.key}
              field={field}
              initialValue={settingMap.get(field.key) ?? ""}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Cabang</h2>
        <BranchManager branches={branches} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Lainnya</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/dashboard/akun"
            className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card active:opacity-90"
          >
            <p className="font-medium">Kelola Akun</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Buat &amp; atur akun staff
            </p>
          </Link>
          <Link
            href="/dashboard/katalog"
            className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card active:opacity-90"
          >
            <p className="font-medium">Katalog</p>
            <p className="mt-1 text-xs text-muted-foreground">Jenis jasa &amp; harga</p>
          </Link>
          <Link
            href="/dashboard/backup"
            className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card active:opacity-90"
          >
            <p className="font-medium">Backup</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unduh &amp; info cadangan
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
