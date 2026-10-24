import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStaffBranchId } from "@/lib/guard";
import { redirect } from "next/navigation";
import { formatRupiah } from "@/lib/service-status";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

export default async function DashboardHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isOperational = role === "OWNER" || role === "ADMIN";
  const showStokStat = role !== "SYS_ADMIN";
  const branchIdStaff = await getStaffBranchId().catch(() => null);
  const branchWhere = branchIdStaff ? { branchId: branchIdStaff } : {};

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [activeServices, waitingBookings, omzetHariIni, openServices, parts] =
    await Promise.all([
      prisma.service.count({
        where: { ...branchWhere, status: { in: ["CHECKED_IN", "IN_PROGRESS", "WAITING_PARTS"] } },
      }),
      prisma.service.count({
        where: { ...branchWhere, status: { in: ["PENDING", "WAITING_APPROVAL"] } },
      }),
      isOperational
        ? prisma.cashflow.aggregate({
            where: { ...branchWhere, type: "INCOME", createdAt: { gte: dayStart } },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
      // Untuk hitung piutang: servis aktif/done belum batal
      isOperational
        ? prisma.service.findMany({
            where: { ...branchWhere, status: { not: "CANCELLED" } },
            include: {
              parts: { select: { price: true, quantity: true } },
              payments: { where: { voidedAt: null }, select: { amount: true } },
            },
          })
        : Promise.resolve([]),
      showStokStat
        ? prisma.part.findMany({
            where: branchWhere,
            select: { quantity: true, minStock: true },
          })
        : Promise.resolve([]),
    ]);

  const piutangTotal = openServices.reduce((sum, s) => {
    const total = s.laborCost + s.parts.reduce((x, p) => x + p.price * p.quantity, 0);
    const paid = s.payments.reduce((x, p) => x + p.amount, 0);
    return sum + Math.max(0, total - paid);
  }, 0);

  const stokMenipis = parts.filter((p) => p.quantity <= p.minStock).length;

  const stats = [
    { label: "Servis Aktif", value: String(activeServices) },
    { label: "Booking Menunggu", value: String(waitingBookings) },
    ...(isOperational
      ? [
          {
            label: "Omzet Hari Ini",
            value: formatRupiah(omzetHariIni?._sum.amount ?? 0),
          },
          {
            label: "Piutang Tertunggak",
            value: formatRupiah(piutangTotal),
            accent: piutangTotal > 0,
          },
        ]
      : []),
    ...(showStokStat
      ? [
          {
            label: "Stok Menipis",
            value: String(stokMenipis),
            accent: stokMenipis > 0,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Halo, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan bengkel hari ini</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
          >
            <p
              className={`text-xl font-bold tabular-nums ${
                stat.accent ? "text-red-600" : ""
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {isOperational && (
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <Link
            href="/dashboard/servis?booking=1"
            className="rounded-xl bg-primary p-4 text-center text-sm font-medium text-white"
          >
            + Booking Baru
          </Link>
          <Link
            href="/dashboard/piutang"
            className="rounded-xl bg-surface p-4 text-center text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-card"
          >
            Lihat Piutang
          </Link>
        </div>
      )}
    </div>
  );
}
