export const metadata = { title: "Pesanan Saya" };

export default async function PesananPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pesanan Saya</h1>
        <p className="mt-1 text-sm text-slate-500">
          Booking servis &amp; riwayat servis kamu
        </p>
      </div>
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="font-medium">Belum ada pesanan</p>
        <p className="mt-1 text-sm text-slate-500">
          Form booking servis akan muncul di sini — pilih kendaraan, keluhan,
          dan jadwal.
        </p>
      </div>
    </div>
  );
}
