import { StaffNav } from "@/components/staff-nav";
import { auth, signOut } from "@/lib/auth";
import { homePathForRole } from "@/lib/role";
import { isOwnerOrSysAdmin } from "@/lib/guard";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CUSTOMER") {
    redirect(homePathForRole(session.user.role));
  }

  const showSettings = isOwnerOrSysAdmin(session.user.role);
  const showPiutang = ["OWNER", "SYS_ADMIN", "ADMIN"].includes(session.user.role);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="font-bold tracking-tight">RevGo</span>
        <div className="flex items-center gap-3">
          <span className="max-w-24 truncate text-sm text-slate-500">
            {session.user.name}
          </span>
          {showPiutang && (
            <Link
              href="/dashboard/piutang"
              className="text-sm font-medium text-slate-700 underline underline-offset-2"
            >
              Piutang
            </Link>
          )}
          {showSettings && (
            <Link
              href="/dashboard/pengaturan"
              className="text-sm font-medium text-slate-700 underline underline-offset-2"
            >
              Atur
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm font-medium text-slate-700 underline underline-offset-2">
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
      <StaffNav role={session.user.role} />
    </div>
  );
}
