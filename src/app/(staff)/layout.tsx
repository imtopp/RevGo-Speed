import { StaffNav, SidebarNav } from "@/components/staff-nav";
import { BrandMark } from "@/components/brand-mark";
import { SubmitButton } from "@/components/submit-button";
import { auth, signOut } from "@/lib/auth";
import { homePathForRole } from "@/lib/role";
import { isOwnerOrSysAdmin } from "@/lib/guard";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CUSTOMER") {
    redirect(homePathForRole(session.user.role));
  }

  const showSettings = isOwnerOrSysAdmin(session.user.role);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop (md+) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-surface md:flex">
        <div className="bg-secondary px-5 py-4 text-white">
          <BrandMark />
        </div>
        <SidebarNav role={session.user.role} />
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-foreground">
            {session.user.name}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="mt-2"
          >
            <SubmitButton
              pendingText="Keluar..."
              className="text-sm font-medium text-foreground underline underline-offset-2 disabled:opacity-60"
            >
              Keluar
            </SubmitButton>
          </form>
        </div>
      </aside>

      {/* Kolom konten */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Header — hanya mobile */}
        <header className="sticky top-0 z-40 flex items-center justify-between bg-secondary px-4 py-3 text-white md:hidden">
          <BrandMark />
          <div className="flex items-center gap-3">
            <span className="max-w-24 truncate text-sm text-slate-300">
              {session.user.name}
            </span>
            {showSettings && (
              <Link
                href="/dashboard/pengaturan"
                className="text-sm font-medium text-slate-200 underline underline-offset-2"
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
              <SubmitButton
                pendingText="Keluar..."
                className="text-sm font-medium text-slate-200 underline underline-offset-2 disabled:opacity-60"
              >
                Keluar
              </SubmitButton>
            </form>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        {/* Bottom nav — hanya mobile */}
        <div className="sticky bottom-0 z-40 md:hidden">
          <StaffNav role={session.user.role} />
        </div>
      </div>
    </div>
  );
}
