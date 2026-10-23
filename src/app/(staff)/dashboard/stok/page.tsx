export const metadata = { title: "Stok" };

export default function StokPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Stok Part</h1>
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="font-medium">Inventori suku cadang</p>
        <p className="mt-1 text-sm text-slate-500">
          Data part, stok masuk/keluar, dan peringatan stok menipis akan muncul
          di sini.
        </p>
      </div>
    </div>
  );
}
