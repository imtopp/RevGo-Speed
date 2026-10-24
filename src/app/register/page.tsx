import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">Buat Akun</h1>
        <p className="mt-1 text-sm text-slate-500">
          Daftar sebagai customer untuk booking servis
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
