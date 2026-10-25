import { prisma } from "@/lib/prisma";
import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { CatalogManager } from "./catalog-manager";
import { CatalogList } from "./catalog-list";

export const metadata = { title: "Katalog Jasa" };

export default async function KatalogPage() {
  await requireOwnerOrSysAdmin();

  const catalog = await prisma.serviceCatalog.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Katalog Jasa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jenis jasa, harga dasar, dan izin DP
        </p>
      </div>

      <CatalogManager />

      <div className="space-y-2">
        {catalog.length === 0 ? (
          <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">
              Belum ada jasa — ketuk &ldquo;+ Tambah Jasa&rdquo; di atas.
            </p>
          </div>
        ) : (
          <CatalogList items={catalog} />
        )}
      </div>
    </div>
  );
}
