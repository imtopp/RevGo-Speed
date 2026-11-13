/**
 * Web Push — notifikasi native-like (booking baru, estimasi, jadwal, batal,
 * selesai, stok menipis).
 *
 * ATURAN:
 * - Semua pengiriman dipanggil lewat `after()` dari server action SETELAH
 *   aksi utama sukses, dibungkus try/catch → push gagal TIDAK PERNAH
 *   menggagalkan aksi bisnis (no-op).
 * - Fitur MATI SENYAP bila env VAPID belum ada (instance/deploy tanpa env
 *   aman — mis. TBRT sebelum env dipasang).
 * - ANTI-DOBEL 4 lapis: (1) guard status aksi + deteksi penyeberangan stok,
 *   (2) klaim `PushSent.dedupKey` unique SEBELUM kirim — aksi paralel/ganda
 *   hanya satu yang menang, (3) payload `tag` = dedupKey → OS menimpa
 *   notif lama, (4) `PushSubscription.endpoint` unique (upsert per device).
 * - Penerima selalu difilter unik + hanya akun aktif berperan sesuai event.
 * - Customer event: penerima unik [customerId, vehicle.ownerId] ber-role
 *   CUSTOMER aktif; walk-in tanpa akun → skip diam.
 */

import { sendNotification, setVapidDetails } from "web-push";
import { prisma } from "@/lib/prisma";
import { formatRupiah, formatTanggalWIB } from "@/lib/service-status";

export type PushPayload = {
  title: string;
  body: string;
  /** = dedupKey — notif dengan tag sama di-replace OS, bukan menumpuk. */
  tag: string;
  url: string;
};

const VAPID_SUBJECT = "mailto:admin@revgo-speed.vercel.app";
/** Notif stok: 1 menit per part = 1 klaim (dua gerakan cepat → 1 notif). */
const STOK_MENIT_BUCKET_MS = 60_000;

// ─── Kunci & klaim anti-dobel ─────────────────────────────────────────

function vapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

/** Env VAPID lengkap → fitur aktif. Dipakai kartu opt-in di UI. */
export function pushEnabled(): boolean {
  return vapidKeys() !== null;
}

/**
 * Klaim dedupKey — true = BOLEH kirim, false = sudah diklaim (atau DB gagal →
 * demi anti-dobel, tidak dikirim). Unique violation dari aksi paralel = false.
 */
async function claimDedup(dedupKey: string): Promise<boolean> {
  try {
    await prisma.pushSent.create({ data: { dedupKey } });
    return true;
  } catch {
    return false;
  }
}

export function dedupBookingBaru(serviceId: string): string {
  return `booking:${serviceId}`;
}
export function dedupEstimasi(serviceId: string): string {
  return `estimasi:${serviceId}`;
}
export function dedupJadwal(serviceId: string, scheduledAtMs: number): string {
  return `jadwal:${serviceId}:${scheduledAtMs}`;
}
export function dedupBatal(serviceId: string): string {
  return `batal:${serviceId}`;
}
export function dedupSelesai(serviceId: string): string {
  return `selesai:${serviceId}`;
}
export function dedupStokMenipis(partId: string, at: Date): string {
  const ms = at.getTime();
  const bucket = Math.floor(ms / STOK_MENIT_BUCKET_MS) * STOK_MENIT_BUCKET_MS;
  return `stok:${partId}:${bucket}`;
}

// ─── Payload (murni — diuji unit test) ────────────────────────────────

export function payloadBookingBaru(d: {
  id: string;
  code: string;
  plate: string;
  scheduledAt: Date;
  tag: string;
}): PushPayload {
  return {
    title: "Booking baru masuk",
    body: `${d.code} · ${d.plate} · ${formatTanggalWIB(d.scheduledAt)}`,
    tag: d.tag,
    url: `/dashboard/servis/${d.id}`,
  };
}

export function payloadEstimasi(d: {
  id: string;
  code: string;
  estimate: number;
  tag: string;
}): PushPayload {
  return {
    title: "Estimasi menunggu persetujuan",
    body: `${d.code} · estimasi ${formatRupiah(d.estimate)} — buka Pesanan untuk menyetujui`,
    tag: d.tag,
    url: "/pesanan",
  };
}

export function payloadJadwal(d: {
  id: string;
  code: string;
  scheduledAt: Date;
  tag: string;
}): PushPayload {
  return {
    title: "Jadwal booking berubah",
    body: `${d.code} → ${formatTanggalWIB(d.scheduledAt)}`,
    tag: d.tag,
    url: "/pesanan",
  };
}

export function payloadBatal(d: {
  id: string;
  code: string;
  reason: string | null;
  tag: string;
}): PushPayload {
  return {
    title: "Booking dibatalkan",
    body: `${d.code}${d.reason ? ` — ${d.reason}` : ""}`,
    tag: d.tag,
    url: "/pesanan",
  };
}

export function payloadSelesai(d: {
  id: string;
  code: string;
  tag: string;
}): PushPayload {
  return {
    title: "Servis selesai",
    body: `${d.code} — motor siap diambil`,
    tag: d.tag,
    url: "/pesanan",
  };
}

export function payloadStokMenipis(d: {
  name: string;
  qty: number;
  unit: string;
  minStock: number;
  tag: string;
}): PushPayload {
  return {
    title: "Stok menipis",
    body: `${d.name} tersisa ${d.qty} ${d.unit} (min ${d.minStock})`,
    tag: d.tag,
    url: "/dashboard/stok",
  };
}

/**
 * Topic RFC 8030 untuk header `Topic` web-push — HANYA karakter
 * Base64-url (`A-Za-z0-9-_`) dan ≤32 char; `sendNotification` melempar
 * sebelum kirim bila melanggar (dedupKey mentah berisi `:`). Dedup tampilan
 * tetap memakai `tag` payload; topic hanya pen-collapse antrean offline.
 */
export function topicAman(tag: string): string {
  return tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}

// ─── Selektor penerima (murni — diuji unit test) ──────────────────────

export function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((x): x is string => !!x))];
}

/** Owner lintas cabang + Admin hanya cabang `branchId`
 *  (branchId null = lintas cabang → semua Admin ikut; aktif saja). */
export function penerimaStaffDari(
  users: { id: string; role: string; branchId: string | null; isActive: boolean }[],
  branchId: string | null,
): string[] {
  return uniqueIds(
    users
      .filter(
        (u) =>
          u.isActive &&
          (u.role === "OWNER" ||
            (u.role === "ADMIN" &&
              (branchId === null || u.branchId === branchId))),
      )
      .map((u) => u.id),
  );
}

/** Kandidat = unik [customerId, ownerId] — hanya CUSTOMER aktif. */
export function penerimaCustomerDari(
  kandidat: (string | null | undefined)[],
  users: { id: string; role: string; isActive: boolean }[],
): string[] {
  const set = new Set(uniqueIds(kandidat));
  return uniqueIds(
    users
      .filter((u) => u.isActive && u.role === "CUSTOMER" && set.has(u.id))
      .map((u) => u.id),
  );
}

/**
 * Penyeberangan batas stok: dari DI ATAS minStock menjadi DI ATAS/SAAT
 * batas (qtySebelum > minStock && qtySesudah <= minStock). minStock <= 0
 * = tanpa batas → tidak pernah memberi peringatan.
 */
export function stokMelintasiBatas(
  qtySebelum: number,
  qtySesudah: number,
  minStock: number,
): boolean {
  if (minStock <= 0) return false;
  return qtySebelum > minStock && qtySesudah <= minStock;
}

// ─── Pengiriman (impure) ──────────────────────────────────────────────

async function kirimKe(userIds: string[], payload: PushPayload): Promise<void> {
  const keys = vapidKeys();
  if (!keys || userIds.length === 0) return;
  let subs;
  try {
    subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });
  } catch {
    return;
  }
  if (subs.length === 0) return;
  try {
    setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  } catch {
    return;
  }
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, topic: topicAman(payload.tag) },
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Endpoint mati (unsubscribed/reset) → buang barisnya, jangan error.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
        }
      }
    }),
  );
}

async function penerimaStaff(branchId: string | null): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OWNER", "ADMIN"] } },
    select: { id: true, role: true, branchId: true, isActive: true },
  });
  return penerimaStaffDari(users, branchId);
}

async function penerimaCustomerService(svc: {
  customerId: string | null;
  vehicle: { ownerId: string | null } | null;
}): Promise<string[]> {
  const kandidat = [svc.customerId, svc.vehicle?.ownerId];
  if (uniqueIds(kandidat).length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds(kandidat) } },
    select: { id: true, role: true, isActive: true },
  });
  return penerimaCustomerDari(kandidat, users);
}

// ─── Orchestrator per event (panggil via after() dari server action) ──

export async function notifyBookingBaru(serviceId: string): Promise<void> {
  try {
    const tag = dedupBookingBaru(serviceId);
    if (!(await claimDedup(tag))) return;
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { vehicle: { select: { plateNumber: true } } },
    });
    if (!svc) return;
    const penerima = await penerimaStaff(svc.branchId);
    await kirimKe(
      penerima,
      payloadBookingBaru({
        id: svc.id,
        code: svc.code,
        plate: svc.vehicle.plateNumber,
        scheduledAt: svc.scheduledAt ?? svc.createdAt,
        tag,
      }),
    );
  } catch {
    /* no-op */
  }
}

export async function notifyEstimasi(serviceId: string): Promise<void> {
  try {
    const tag = dedupEstimasi(serviceId);
    if (!(await claimDedup(tag))) return;
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { vehicle: { select: { ownerId: true } } },
    });
    if (!svc) return;
    const penerima = await penerimaCustomerService(svc);
    await kirimKe(
      penerima,
      payloadEstimasi({
        id: svc.id,
        code: svc.code,
        estimate: svc.estimate,
        tag,
      }),
    );
  } catch {
    /* no-op */
  }
}

export async function notifyJadwalDiubah(serviceId: string): Promise<void> {
  try {
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { vehicle: { select: { ownerId: true } } },
    });
    if (!svc) return;
    const jadwal = svc.scheduledAt ?? svc.createdAt;
    // Key per jadwal baru — ganti jadwal 2x = 2 notif (bukan dobel, beda key).
    const tag = dedupJadwal(svc.id, jadwal.getTime());
    if (!(await claimDedup(tag))) return;
    const penerima = await penerimaCustomerService(svc);
    await kirimKe(
      penerima,
      payloadJadwal({
        id: svc.id,
        code: svc.code,
        scheduledAt: jadwal,
        tag,
      }),
    );
  } catch {
    /* no-op */
  }
}

export async function notifyBatal(serviceId: string): Promise<void> {
  try {
    const tag = dedupBatal(serviceId);
    if (!(await claimDedup(tag))) return;
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { vehicle: { select: { ownerId: true } } },
    });
    if (!svc) return;
    const penerima = await penerimaCustomerService(svc);
    await kirimKe(
      penerima,
      payloadBatal({
        id: svc.id,
        code: svc.code,
        reason: svc.cancelReason,
        tag,
      }),
    );
  } catch {
    /* no-op */
  }
}

export async function notifySelesai(serviceId: string): Promise<void> {
  try {
    const tag = dedupSelesai(serviceId);
    if (!(await claimDedup(tag))) return;
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { vehicle: { select: { ownerId: true } } },
    });
    if (!svc) return;
    const penerima = await penerimaCustomerService(svc);
    await kirimKe(
      penerima,
      payloadSelesai({ id: svc.id, code: svc.code, tag }),
    );
  } catch {
    /* no-op */
  }
}

/**
 * Peringatan stok menipis — hanya bila qty MENYEBERANGI batas (dari di atas
 * menjadi di bawah/sama dengan minStock), jadi gerakan berulang di bawah
 * batas tidak spam. Panggil setelah transaksi stok sukses.
 */
export async function notifyStokMenipis(
  partId: string,
  qtySebelum: number,
  qtySesudah: number,
): Promise<void> {
  try {
    const part = await prisma.part.findUnique({ where: { id: partId } });
    if (!part) return;
    if (!stokMelintasiBatas(qtySebelum, qtySesudah, part.minStock)) return;
    const tag = dedupStokMenipis(partId, new Date());
    if (!(await claimDedup(tag))) return;
    const penerima = await penerimaStaff(part.branchId);
    await kirimKe(
      penerima,
      payloadStokMenipis({
        name: part.name,
        qty: qtySesudah,
        unit: part.unit,
        minStock: part.minStock,
        tag,
      }),
    );
  } catch {
    /* no-op */
  }
}
