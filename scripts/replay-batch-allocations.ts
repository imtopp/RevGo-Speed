import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type Batch = { movementId: string; remaining: number };

type Ev = {
  at: Date;
  kind: "in" | "out" | "consume";
  movementId: string;
  qty: number;
  spId?: string;
};

/**
 * Replay riwayat FIFO per part → mengisi PartBatchUsage untuk servis lama
 * (sebelum fitur alokasi batch). Idempoten: ServicePart yang sudah punya
 * jejak alokasi dilewati. Tidak mengubah ServicePart.cost / kas apa pun.
 */
async function replayPart(partId: string) {
  const movements = await prisma.stockMovement.findMany({
    where: { partId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, quantity: true, note: true, createdAt: true },
  });
  const serviceParts = await prisma.servicePart.findMany({
    where: { partId },
    orderBy: { id: "asc" },
    include: { service: { select: { code: true, createdAt: true } } },
  });

  const existing = await prisma.partBatchUsage.findMany({
    where: { servicePart: { partId } },
    select: { servicePartId: true },
  });
  const doneSet = new Set(existing.map((u) => u.servicePartId));
  const pending = serviceParts.filter((sp) => !doneSet.has(sp.id));
  if (pending.length === 0) return { created: 0, warnings: 0 };

  // OUT "Terpakai di servis CODE" → waktu konsumsi asli per ServicePart.
  const outByCode = new Map<string, { qty: number; at: Date }[]>();
  for (const m of movements) {
    if (m.type !== "OUT" || !m.note?.startsWith("Terpakai di servis ")) continue;
    const code = m.note.slice("Terpakai di servis ".length);
    const arr = outByCode.get(code) ?? [];
    arr.push({ qty: m.quantity, at: m.createdAt });
    outByCode.set(code, arr);
  }

  const events: Ev[] = [];
  for (const m of movements) {
    if (m.type === "IN") {
      events.push({ at: m.createdAt, kind: "in", movementId: m.id, qty: m.quantity });
    } else if (!m.note?.startsWith("Terpakai di servis ")) {
      events.push({ at: m.createdAt, kind: "out", movementId: m.id, qty: m.quantity });
    }
  }

  let warnings = 0;
  const rows: { movementId: string; servicePartId: string; quantity: number }[] = [];
  for (const sp of pending) {
    const list = outByCode.get(sp.service.code) ?? [];
    const idx = list.findIndex((o) => o.qty === sp.quantity);
    const at = idx >= 0 ? (list.splice(idx, 1)[0]?.at ?? sp.service.createdAt) : sp.service.createdAt;
    events.push({ at, kind: "consume", movementId: "", qty: sp.quantity, spId: sp.id });
  }

  const rank = { in: 0, consume: 1, out: 2 } as const;
  events.sort(
    (a, b) => a.at.getTime() - b.at.getTime() || rank[a.kind] - rank[b.kind],
  );

  const batches: Batch[] = [];
  for (const ev of events) {
    if (ev.kind === "in") {
      batches.push({ movementId: ev.movementId, remaining: ev.qty });
      continue;
    }
    let need = ev.qty;
    for (const b of batches) {
      if (need <= 0) break;
      const ambil = Math.min(b.remaining, need);
      if (ambil <= 0) continue;
      b.remaining -= ambil;
      need -= ambil;
      if (ev.kind === "consume" && ev.spId) {
        rows.push({ movementId: b.movementId, servicePartId: ev.spId, quantity: ambil });
      }
    }
    if (need > 0 && ev.kind === "consume") {
      // Sisa tanpa batch cukup: tidak ditempelkan (lebih aman under-trace
      // daripada over-bound koreksi). Dilaporkan sebagai warning.
      warnings += 1;
    }
  }

  if (rows.length > 0) {
    await prisma.partBatchUsage.createMany({ data: rows, skipDuplicates: true });
  }
  return { created: rows.length, warnings };
}

const parts = await prisma.part.findMany({ select: { id: true, name: true } });
let totalCreated = 0;
let totalWarnings = 0;
let partsTouched = 0;
for (const p of parts) {
  const r = await replayPart(p.id);
  if (r.created > 0) {
    partsTouched += 1;
    totalCreated += r.created;
    totalWarnings += r.warnings;
    console.log(`  ${p.name}: ${r.created} alokasi${r.warnings ? ` (${r.warnings} tanpa batch cukup)` : ""}`);
  }
}
console.log(
  `SELESAI — ${partsTouched} part, ${totalCreated} alokasi dibuat` +
    (totalWarnings ? `, ${totalWarnings} tanpa batch cukup (fallback)` : ""),
);
await prisma.$disconnect();
