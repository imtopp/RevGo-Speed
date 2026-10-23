export const metadata = { title: "Servis" };

export default function ServisPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Servis</h1>
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="font-medium">Booking &amp; proses servis</p>
        <p className="mt-1 text-sm text-slate-500">
          Daftar booking, penugasan mekanik, dan status pengerjaan akan muncul
          di sini.
        </p>
      </div>
    </div>
  );
}
