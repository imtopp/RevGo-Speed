import { LoginForm } from "@/components/login-form";
import { auth } from "@/lib/auth";
import { homePathForRole } from "@/lib/role";
import { getBranding } from "@/lib/branding";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(homePathForRole(session.user.role));
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
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{appName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Masuk untuk mengelola bengkel
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Daftar
          </Link>
        </p>
      </div>
    </main>
  );
}
