import { LoginForm } from "@/components/login-form";
import { auth } from "@/lib/auth";
import { homePathForRole } from "@/lib/role";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(homePathForRole(session.user.role));

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold tracking-tight">RevGo</h1>
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
