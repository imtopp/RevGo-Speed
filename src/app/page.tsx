import { auth } from "@/lib/auth";
import { homePathForRole } from "@/lib/role";
import Link from "next/link";
import { redirect } from "next/navigation";

const features = [
  "Booking servis mudah, langsung dari HP",
  "Pantau status servis secara real-time",
  "Setujui estimasi sebelum dikerjakan",
  "Riwayat servis & tagihan dalam satu tempat",
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(homePathForRole(session.user.role));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6 md:max-w-lg">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Servis Kendaraan
        </p>
        <h1 className="sr-only">RevGo Speed</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-title.png"
          alt=""
          width={750}
          height={750}
          className="mt-3 h-36 w-auto md:h-44"
        />
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Booking, pantau, dan bayar servis kendaraan kamu — tanpa perlu
          antre atau menelepon. Semua bisa dilakukan dari HP.
        </p>
      </div>

      <ul className="space-y-2">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm font-medium text-foreground ring-1 ring-slate-200 shadow-card"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
            />
            {feature}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Link
          href="/login"
          className="block w-full rounded-xl bg-primary py-3 text-center font-medium text-white active:opacity-90"
        >
          Masuk
        </Link>
        <Link
          href="/register"
          className="block w-full rounded-xl bg-surface py-3 text-center font-medium text-foreground ring-1 ring-slate-300 active:opacity-90"
        >
          Daftar Akun Customer
        </Link>
      </div>
    </main>
  );
}
