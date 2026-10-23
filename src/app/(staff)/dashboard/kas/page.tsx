export const metadata = { title: "Kas" };

export default function KasPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Kas</h1>
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="font-medium">Arus kas bengkel</p>
        <p className="mt-1 text-sm text-slate-500">
          Pencatatan kas masuk &amp; keluar beserta ringkasannya akan muncul di
          sini.
        </p>
      </div>
    </div>
  );
}
