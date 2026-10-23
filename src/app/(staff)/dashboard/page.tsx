import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

export default async function DashboardHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [activeServices, pendingBookings, partTypes, todayTransactions] =
    await Promise.all([
      prisma.service.count({
        where: { status: { in: ["IN_PROGRESS", "WAITING_PARTS"] } },
      }),
      prisma.service.count({ where: { status: "PENDING" } }),
      prisma.part.count(),
      prisma.cashflow.count({ where: { createdAt: { gte: dayStart } } }),
    ]);

  const stats = [
    { label: "Servis Aktif", value: activeServices },
    { label: "Booking Menunggu", value: pendingBookings },
    { label: "Jenis Part", value: partTypes },
    { label: "Transaksi Hari Ini", value: todayTransactions },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          Halo, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Ringkasan bengkel hari ini</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
          >
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
