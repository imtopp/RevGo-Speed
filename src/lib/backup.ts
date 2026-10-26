/**
 * Sumber tunggal daftar tabel backup (export & import/restore).
 *
 * ⚠️ PENTING — SINKRONISASI DENGAN SKEMA:
 * Setiap perubahan `prisma/schema.prisma` (tambah/hapus model, ganti kolom
 * atau tipe data) WAJIB diikuti penyesuaian daftar `BACKUP_TABLES` di bawah
 * (field `model`, `delegate`, `key`) beserta export & import route bila
 * diperlukan. Unit test `src/lib/backup.test.ts` membaca `schema.prisma`
 * dan GAGAL otomatis kalau daftar ini tidak sinkron — jangan di-skip.
 *
 * Urutan `BACKUP_TABLES` = urutan CREATE (parent → child);
 * urutan DELETE (restore replace) = kebalikannya.
 */

export type BackupTableDef = {
  /** Nama model persis di schema.prisma (dicek unit test). */
  model: string;
  /** Properti delegate Prisma client (mis. `prisma.partSale`). */
  delegate: string;
  /** Key JSON di file backup (kompatibel dengan file export lama). */
  key: string;
};

export const BACKUP_TABLES: BackupTableDef[] = [
  { model: "SystemSetting", delegate: "systemSetting", key: "systemSettings" },
  { model: "Branch", delegate: "branch", key: "branches" },
  { model: "Supplier", delegate: "supplier", key: "suppliers" },
  { model: "ServiceCatalog", delegate: "serviceCatalog", key: "serviceCatalog" },
  { model: "User", delegate: "user", key: "users" },
  { model: "Vehicle", delegate: "vehicle", key: "vehicles" },
  { model: "Part", delegate: "part", key: "parts" },
  { model: "StockMovement", delegate: "stockMovement", key: "stockMovements" },
  { model: "Service", delegate: "service", key: "services" },
  { model: "ServicePart", delegate: "servicePart", key: "serviceParts" },
  { model: "PartSale", delegate: "partSale", key: "partSales" },
  { model: "PartSaleItem", delegate: "partSaleItem", key: "partSaleItems" },
  { model: "Payment", delegate: "payment", key: "payments" },
  { model: "PartBatchUsage", delegate: "partBatchUsage", key: "partBatchUsage" },
  { model: "Cashflow", delegate: "cashflow", key: "cashflows" },
  { model: "AuditLog", delegate: "auditLog", key: "auditLogs" },
  { model: "RateLimitBucket", delegate: "rateLimitBucket", key: "rateLimitBuckets" },
];

const KNOWN_KEYS = new Set(BACKUP_TABLES.map((t) => t.key));

export type BackupData = Record<string, Record<string, unknown>[]>;

export type BackupPayload = {
  exportedAt: string;
  app: string;
  data: BackupData;
};

export type ParsedBackup =
  | {
      ok: true;
      payload: BackupPayload;
      counts: Record<string, number>;
      /** Tabel dikenal yang tidak ada di file (diisi kosong saat restore). */
      missingTables: string[];
      /** Key asing di file yang tidak dikenal aplikasi (diabaikan). */
      ignoredKeys: string[];
    }
  | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse + validasi file backup (murni — tanpa DB).
 * File dari versi lama: tabel yang belum ada → `missingTables` (diisi kosong).
 * File dari versi lebih baru: key tak dikenal → `ignoredKeys` (diabaikan).
 * File yang bukan backup / struktur rusak → `ok:false` dengan pesan jelas.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `File bukan JSON valid (${(e as Error).message}).` };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, error: "File bukan objek JSON — bukan file backup." };
  }

  const rawData = raw.data;
  if (!isPlainObject(rawData)) {
    return {
      ok: false,
      error: 'File tidak memuat properti "data" — bukan file backup yang benar.',
    };
  }

  const counts: Record<string, number> = {};
  const missingTables: string[] = [];
  const data: BackupData = {};

  for (const t of BACKUP_TABLES) {
    const value = rawData[t.key];
    if (value === undefined) {
      missingTables.push(t.key);
      data[t.key] = [];
      continue;
    }
    if (!Array.isArray(value)) {
      return { ok: false, error: `Tabel "${t.key}" bukan array — file rusak atau bukan backup.` };
    }
    for (let i = 0; i < value.length; i++) {
      if (!isPlainObject(value[i])) {
        return {
          ok: false,
          error: `Baris ke-${i + 1} di tabel "${t.key}" bukan objek — file rusak.`,
        };
      }
    }
    data[t.key] = value as Record<string, unknown>[];
    counts[t.key] = value.length;
  }

  if (missingTables.length === BACKUP_TABLES.length) {
    return {
      ok: false,
      error:
        "File tidak memuat satu pun tabel yang dikenal — ini bukan file backup RevGo Speed, atau formatnya sudah berubah total.",
    };
  }

  const ignoredKeys = Object.keys(rawData).filter((k) => !KNOWN_KEYS.has(k));

  return {
    ok: true,
    payload: {
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
      app: typeof raw.app === "string" ? raw.app : "",
      data,
    },
    counts,
    missingTables,
    ignoredKeys,
  };
}
