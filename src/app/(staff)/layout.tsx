import { StaffNav } from "@/components/staff-nav";
import { auth, signOut } from "@/lib/auth";
import { homePathForRole } from "@/lib/role";
import { redirect } from "next/navigation";

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

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="font-bold tracking-tight">RevLedger</span>
        <div className="flex items-center gap-3">
          <span className="max-w-32 truncate text-sm text-slate-500">
            {session.user.name}
          </span>
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
      <StaffNav />
    </div>
  );
}
