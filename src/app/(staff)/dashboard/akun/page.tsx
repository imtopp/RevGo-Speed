import { prisma } from "@/lib/prisma";
import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { StaffForm } from "./staff-form";
import { UserList } from "./user-list";

export const metadata = { title: "Kelola Akun" };

const STAFF_ROLES = ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"] as const;
/** Batas customer yang ditampilkan (urut terbaru) — jaga render tetap ringan. */
const MAX_CUSTOMER_TAMPIL = 50;

export default async function AkunPage() {
  await requireOwnerOrSysAdmin();

  const [staff, customer, totalCustomer, branches] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
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
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      take: MAX_CUSTOMER_TAMPIL,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
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
        <p className="mt-1 text-sm text-muted-foreground">
          Buat &amp; atur akun staff (SysAdmin, Admin, Mekanik)
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Akun Staff Baru
        </h2>
        <StaffForm branches={branches} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Akun Staff
        </h2>
        <p className="text-xs text-muted-foreground">
          Owner &amp; SysAdmin lintas cabang; Admin &amp; Mekanik terikat 1
          cabang.
        </p>
        <UserList users={staff} branches={branches} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Akun Customer
        </h2>
        <p className="text-xs text-muted-foreground">
          Terdaftar dari booking/registrasi — reset password &amp; nonaktifkan
          saja, tanpa penempatan cabang.
          {totalCustomer > MAX_CUSTOMER_TAMPIL &&
            ` Menampilkan ${MAX_CUSTOMER_TAMPIL} terbaru dari ${totalCustomer}.`}
        </p>
        <UserList users={customer} branches={branches} />
      </section>
    </div>
  );
}
