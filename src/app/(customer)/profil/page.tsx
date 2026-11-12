import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfilForm } from "./form";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  });
  if (!user || !user.email) redirect("/login");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Data akun &amp; nomor WhatsApp kamu
        </p>
      </div>

      <ProfilForm name={user.name} email={user.email} phone={user.phone} />

      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <p className="text-sm font-semibold text-foreground">Password</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ganti password akun kamu.
        </p>
        <Link
          href="/ganti-password"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-2"
        >
          Ubah password &rarr;
        </Link>
      </div>
    </div>
  );
}
