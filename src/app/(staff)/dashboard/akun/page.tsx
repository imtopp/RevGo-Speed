import { prisma } from "@/lib/prisma";
import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { StaffForm } from "./staff-form";
import { UserList } from "./user-list";

export const metadata = { title: "Kelola Akun" };

export default async function AkunPage() {
  await requireOwnerOrSysAdmin();

  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.branch.findMany({
      where: { aktif: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Kelola Akun</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat &amp; atur akun staff (SysAdmin, Admin, Mekanik)
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Akun Staff Baru
        </h2>
        <StaffForm branches={branches} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Semua Akun</h2>
        <UserList users={users} branches={branches} />
      </section>
    </div>
  );
}
