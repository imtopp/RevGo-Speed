import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CUSTOMER") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-50">
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
    </div>
  );
}
