import type { Prisma, Role } from "@db/prisma/client";

export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

function jsonSafe(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Catat aksi kritikal ke AuditLog (append-only).
 * WAJIB dipanggil di dalam transaksi DB yang sama dengan aksinya,
 * agar aksi sukses ⇔ log tersimpan (tidak ada log yatim / jejak hilang).
 */
export async function logAudit(
  db: Prisma.TransactionClient,
  actor: { id: string; role: Role },
  input: AuditInput,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { name: true },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      actorName: user?.name ?? "Tidak diketahui",
      actorRole: actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      branchId: input.branchId ?? null,
      summary: input.summary,
      before: input.before ? jsonSafe(input.before) : undefined,
      after: input.after ? jsonSafe(input.after) : undefined,
    },
  });
}
