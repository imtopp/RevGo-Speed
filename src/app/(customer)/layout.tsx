import { auth, signOut } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-none flex-col bg-background md:max-w-3xl">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-secondary px-4 py-3 text-white">
        <BrandMark />
        <div className="flex items-center gap-3">
          <span className="max-w-32 truncate text-sm text-slate-300">
            {session.user.name}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm font-medium text-slate-200 underline underline-offset-2">
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
