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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:max-w-md">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mb-3 h-10 w-10 rounded object-contain" />
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight">{appName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Masuk untuk mengelola bengkel
        </p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            Daftar
          </Link>
        </p>
      </div>
    </main>
  );
}
