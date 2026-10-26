import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/guard";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/service-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit" };

const ACTION_LABEL: Record<string, string> = {
  PAYMENT_CREATE: "Bayar servis",
  PAYMENT_VOID: "Void pembayaran",
  CASHFLOW_MANUAL: "Kas manual",
  STOCK_IN: "Stok masuk (beli)",
  STOCK_ADJUST: "Penyesuaian stok",
  PART_UPDATE: "Ubah harga part",
  PART_DELETE: "Hapus part",
  SERVICE_CREATE: "Servis dibuat",
  SERVICE_STATUS: "Status servis",
  SERVICE_PART_ADD: "Part dipakai",
  SERVICE_PART_REMOVE: "Part dikembalikan",
  SETTING_UPDATE: "Ubah pengaturan",
  BRANCH_CREATE: "Cabang dibuat",
  BRANCH_UPDATE: "Cabang diubah",
  ACCOUNT_CREATE: "Akun dibuat",
  ACCOUNT_RESET_PASSWORD: "Reset password",
  ACCOUNT_TOGGLE: "Aktif/nonaktif akun",
  ACCOUNT_ASSIGN: "Assign cabang",
};

const CHIPS: { action: string | null; label: string }[] = [
  { action: null, label: "Semua" },
  { action: "PAYMENT_VOID", label: "Void" },
  { action: "PAYMENT_CREATE", label: "Bayar" },
  { action: "CASHFLOW_MANUAL", label: "Kas manual" },
  { action: "STOCK_ADJUST", label: "Stok" },
  { action: "STOCK_IN", label: "Beli part" },
  { action: "SERVICE_STATUS", label: "Servis" },
  { action: "SETTING_UPDATE", label: "Pengaturan" },
];

function fmtWaktu(d: Date): string {
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlertCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span
          className={`text-lg font-bold ${
            count > 0 ? "text-danger" : "text-success"
          }`}
        >
          {count}
        </span>
      </div>
      {count > 0 && children && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{children}</ul>
      )}
    </div>
  );
}

const HALAMAN_SIZE = 200;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireStaffRole(["OWNER"]);
  const { action, page: pageRaw } = await searchParams;
  const filterAction = action && action in ACTION_LABEL ? action : null;
  // Nomor halaman dari URL — nilai asing jangan jadi skip negatif/NaN.
  const halaman =
    pageRaw && /^\d+$/.test(pageRaw) ? Math.max(1, Number(pageRaw)) : 1;
  const skip = (halaman - 1) * HALAMAN_SIZE;
  const whereLog = filterAction ? { action: filterAction } : {};

  const [logs, totalLogs, voidedCount, voidedPayments, laborRaw, partRaw, adjustLogs] =
    await Promise.all([
      prisma.auditLog.findMany({
        where: whereLog,
        orderBy: { createdAt: "desc" },
        skip,
        take: HALAMAN_SIZE,
      }),
      prisma.auditLog.count({ where: whereLog }),
      prisma.payment.count({ where: { voidedAt: { not: null } } }),
      prisma.payment.findMany({
        where: { voidedAt: { not: null } },
        include: { service: { select: { code: true } } },
        orderBy: { voidedAt: "desc" },
        take: 5,
      }),
      prisma.service.findMany({
        where: {
          catalogId: { not: null },
          status: {
            in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "WAITING_PARTS", "DONE"],
          },
        },
        include: {
          catalog: { select: { nama: true, hargaDasar: true } },
          vehicle: { select: { plateNumber: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.servicePart.findMany({
        include: {
          part: { select: { name: true, sellPrice: true } },
          service: { select: { code: true } },
        },
        take: 300,
      }),
      prisma.auditLog.findMany({
        where: { action: "STOCK_ADJUST" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const laborFlags = laborRaw.filter(
    (s) => s.catalog && s.laborCost > 0 && s.laborCost < s.catalog.hargaDasar,
  );
  const partFlags = partRaw.filter((sp) => sp.price < sp.part.sellPrice);
  const adaSebelum = halaman > 1;
  const adaSesudah = skip + logs.length < totalLogs;
  const hrefHalaman = (n: number) => {
    const q = new URLSearchParams();
    if (filterAction) q.set("action", filterAction);
    if (n > 1) q.set("page", String(n));
    return `/dashboard/audit?${q.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Audit</h1>
        <p className="text-sm text-muted-foreground">
          Jejak aksi kritikal (append-only) &amp; sinyal penyimpangan.
          Tinjau kartu peringatan dulu, lalu log.
        </p>
      </div>

      {/* Peringatan */}
      <div className="grid grid-cols-2 gap-3">
        <AlertCard title="Pembayaran dibatalkan" count={voidedCount}>
          {voidedPayments.map((p) => (
            <li key={p.id}>
              <span className="font-medium">{p.service?.code ?? "—"}</span> ·{" "}
              {formatRupiah(p.amount)} — {p.voidReason}
            </li>
          ))}
        </AlertCard>
        <AlertCard title="Jasa &lt; harga katalog" count={laborFlags.length}>
          {laborFlags.slice(0, 5).map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.code}</span> ·{" "}
              {s.vehicle.plateNumber} · {formatRupiah(s.laborCost)} dari{" "}
              {formatRupiah(s.catalog!.hargaDasar)} ({s.catalog!.nama})
            </li>
          ))}
          {laborFlags.length > 5 && (
            <li className="text-slate-400">…{laborFlags.length - 5} lagi</li>
          )}
        </AlertCard>
        <AlertCard title="Part &lt; harga jual" count={partFlags.length}>
          {partFlags.slice(0, 5).map((sp) => (
            <li key={sp.id}>
              <span className="font-medium">{sp.service.code}</span> ·{" "}
              {sp.part.name} · {formatRupiah(sp.price)} dari{" "}
              {formatRupiah(sp.part.sellPrice)}
            </li>
          ))}
          {partFlags.length > 5 && (
            <li className="text-slate-400">…{partFlags.length - 5} lagi</li>
          )}
        </AlertCard>
        <AlertCard title="Stok disesuaikan (10 terakhir)" count={adjustLogs.length}>
          {adjustLogs.map((l) => (
            <li key={l.id}>{l.summary}</li>
          ))}
        </AlertCard>
      </div>

      {/* Filter aksi */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const active = (c.action ?? null) === (filterAction ?? null);
          return (
            <Link
              key={c.label}
              href={c.action ? `/dashboard/audit?action=${c.action}` : "/dashboard/audit"}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                active
                  ? "bg-primary text-white ring-primary"
                  : "bg-surface text-muted-foreground ring-slate-200"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Log */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Log aksi {filterAction ? `· ${ACTION_LABEL[filterAction]}` : ""}
          </h2>
          <span className="text-xs text-muted-foreground">
            {totalLogs === 0
              ? "0 entri"
              : logs.length === 0
                ? `Halaman kosong dari ${totalLogs.toLocaleString("id-ID")} entri`
                : `Menampilkan ${skip + 1}–${skip + logs.length} dari ${totalLogs.toLocaleString("id-ID")} entri`}
          </span>
        </div>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {totalLogs === 0
              ? "Belum ada log untuk filter ini."
              : "Tidak ada entri di halaman ini."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-slate-400">
                    {fmtWaktu(l.createdAt)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {ACTION_LABEL[l.action] ?? l.action}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {l.actorName}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({l.actorRole})
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground">{l.summary}</p>
                {(l.before || l.after) && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Detail perubahan
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(
                        {
                          ...(l.before ? { before: l.before } : {}),
                          ...(l.after ? { after: l.after } : {}),
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {(adaSebelum || adaSesudah) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            {adaSebelum ? (
              <Link
                href={hrefHalaman(halaman - 1)}
                className="rounded-lg border border-slate-300 bg-surface px-3 py-1.5 text-xs font-medium text-foreground active:opacity-90"
              >
                ← Sebelumnya
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">
              Halaman {halaman.toLocaleString("id-ID")}
            </span>
            {adaSesudah ? (
              <Link
                href={hrefHalaman(halaman + 1)}
                className="rounded-lg border border-slate-300 bg-surface px-3 py-1.5 text-xs font-medium text-foreground active:opacity-90"
              >
                Berikutnya →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
