import { auth } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { redirect } from "next/navigation";
import { GantiPasswordForm } from "./form";

export const metadata = { title: "Ganti Password" };

export default async function GantiPasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { appName, logoUrl } = await getBranding();

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card ring-1 ring-slate-200 md:max-w-md">
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-14 w-14 rounded-2xl object-contain"
            />
          ) : null}
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            Ganti Password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{appName}</p>
        </div>
        <div className="mt-6">
          <GantiPasswordForm wajib={session.user.mustChange} />
        </div>
      </div>
    </main>
  );
}
