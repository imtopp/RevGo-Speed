import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAppName } from "@/lib/branding";
import { BACKUP_TABLES } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  // OWNER + SysAdmin: ekspor memuat passwordHash semua user —
  // jangan sampai Admin (atau di bawahnya) mengekstrak hash.
  const role = session?.user?.role;
  if (role !== "OWNER" && role !== "SYS_ADMIN") {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  // Daftar tabel ikut src/lib/backup.ts — tambah model schema.prisma
  // → wajib update juga di sana (dicek unit test).
  const delegates = prisma as unknown as Record<
    string,
    { findMany: () => Promise<unknown[]> }
  >;
  const rows = await Promise.all(BACKUP_TABLES.map((t) => delegates[t.delegate].findMany()));
  const data: Record<string, unknown[]> = {};
  BACKUP_TABLES.forEach((t, i) => {
    data[t.key] = rows[i];
  });

  const appName = await getAppName();

  const payload = {
    exportedAt: new Date().toISOString(),
    app: appName,
    data,
  };

  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  const filename = `${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
