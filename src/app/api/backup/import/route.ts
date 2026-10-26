import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { BACKUP_TABLES, parseBackup, type BackupPayload } from "@/lib/backup";
import type { Role } from "@db/prisma/client";

export const dynamic = "force-dynamic";

const KONFIRMASI = "RESTORE";

type Actor = { id: string; name?: string | null; role: Role };

/**
 * Restore penuh (replace): SEMUA data existing dihapus lalu diganti isi file
 * backup, dalam SATU transaksi DB — gagal di tengah = tidak ada perubahan
 * sama sekali (rollback), data lama tetap utuh.
 */
async function restoreReplace(payload: BackupPayload, actor: Actor) {
  type Db = Record<
    string,
    {
      deleteMany: () => Promise<{ count: number }>;
      createMany: (args: { data: unknown[] }) => Promise<{ count: number }>;
    }
  >;
  // Urutan delete = kebalikan urutan create (child → parent, hormati FK).
  const deleteOrder = [...BACKUP_TABLES].reverse();

  const counts: Record<string, number> = {};
  let total = 0;

  await prisma.$transaction(
    async (tx) => {
      const txd = tx as unknown as Db;
      for (const t of deleteOrder) {
        await txd[t.delegate].deleteMany();
      }
      for (const t of BACKUP_TABLES) {
        const rows = payload.data[t.key] ?? [];
        if (rows.length) {
          await txd[t.delegate].createMany({ data: rows });
        }
        counts[t.key] = rows.length;
        total += rows.length;
      }
      // Jejak restore ditulis SETELAH isi file, di transaksi yang sama
      // (append-only di atas auditLogs hasil restore).
      await logAudit(tx, { id: actor.id, role: actor.role }, {
        action: "SYSTEM_IMPORT",
        entityType: "Backup",
        summary: `Restore penuh dari file backup (diekspor ${payload.exportedAt || "?"}) — ${total} baris`,
        after: { counts },
      });
    },
    { timeout: 120_000, maxWait: 15_000 },
  );

  return { counts, total };
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  const role = user?.role;
  if (!user || (role !== "OWNER" && role !== "SYS_ADMIN")) {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body harus multipart/form-data." }, { status: 400 });
  }

  const konfirmasi = String(form.get("konfirmasi") ?? "");
  if (konfirmasi !== KONFIRMASI) {
    return NextResponse.json(
      { error: `Konfirmasi salah — ketik persis "${KONFIRMASI}" untuk melanjutkan.` },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File backup tidak ditemukan." }, { status: 400 });
  }

  const parsed = parseBackup(await file.text());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { counts, total } = await restoreReplace(parsed.payload, {
      id: user.id,
      name: user.name,
      role,
    });

    // Audit log bawaan file ikut terganti; jejak restore ditulis di dalam
    // transaksi (SYSTEM_IMPORT). Refresh cache halaman.
    revalidatePath("/", "layout");

    return NextResponse.json({
      ok: true,
      app: parsed.payload.app,
      exportedAt: parsed.payload.exportedAt,
      total,
      counts,
      missingTables: parsed.missingTables,
      ignoredKeys: parsed.ignoredKeys,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Restore gagal — transaksi dibatalkan, data lama TIDAK berubah. Detail: ${msg}`,
      },
      { status: 500 },
    );
  }
}
