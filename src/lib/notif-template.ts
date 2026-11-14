/**
 * Template notifikasi yang bisa diedit OWNER/SYS_ADMIN di
 * /dashboard/pengaturan/notifikasi — berlaku untuk push (6 event) dan
 * pesan pratinjau WhatsApp (3 template).
 *
 * - Default tersimpan di `TEMPLATE_DEFS`; override admin di SystemSetting
 *   `notif_templates` (JSON) — kosong = pakai default.
 * - `renderTemplate` mengganti `{variabel}`; token tak dikenal dibiarkan
 *   apa adanya supaya salah ketik kelihatan.
 * - Sebagian variabel opsional membawa pemisahnya sendiri (mis. `{alasan}`
 *   = " — alasan…" atau "" bila kosong) supaya default tidak pernah
 *   menghasilkan baris/kalimat kosong.
 *
 * Modul ini MURNI (tanpa prisma) — aman diimpor komponen client.
 * Pembacaan dari DB: `muatTemplateNotif` di `notif-template-db.ts`.
 */

export type TemplateField = "title" | "body";

export type TemplateFieldDef = {
  name: TemplateField;
  label: string;
  default: string;
  variabel: string[];
  /** Penjelasan singkat token yang tidak jelas dari namanya saja. */
  catatan?: string;
};

export type TemplateDef = {
  id: string;
  grup: "Push" | "WhatsApp";
  label: string;
  fields: TemplateFieldDef[];
};

export type TemplateInput = Partial<Record<TemplateField, string>>;

export type TemplateOverrides = Record<string, TemplateInput>;

export const NOTIF_TEMPLATES_KEY = "notif_templates";
export const TPL_TITLE_MAX = 120;
export const TPL_BODY_MAX = 1200;

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    id: "push.booking_baru",
    grup: "Push",
    label: "Booking baru masuk",
    fields: [
      { name: "title", label: "Judul", default: "Booking baru masuk", variabel: [] },
      {
        name: "body",
        label: "Isi",
        default: "{code} · {plate} · {jadwal}",
        variabel: ["code", "plate", "jadwal"],
      },
    ],
  },
  {
    id: "push.estimasi",
    grup: "Push",
    label: "Estimasi menunggu persetujuan",
    fields: [
      {
        name: "title",
        label: "Judul",
        default: "Estimasi menunggu persetujuan",
        variabel: [],
      },
      {
        name: "body",
        label: "Isi",
        default: "{code} · estimasi {estimasi} — buka Pesanan untuk menyetujui",
        variabel: ["code", "estimasi"],
      },
    ],
  },
  {
    id: "push.jadwal",
    grup: "Push",
    label: "Jadwal booking berubah",
    fields: [
      { name: "title", label: "Judul", default: "Jadwal booking berubah", variabel: [] },
      { name: "body", label: "Isi", default: "{code} → {jadwal}", variabel: ["code", "jadwal"] },
    ],
  },
  {
    id: "push.batal",
    grup: "Push",
    label: "Booking dibatalkan",
    fields: [
      { name: "title", label: "Judul", default: "Booking dibatalkan", variabel: [] },
      {
        name: "body",
        label: "Isi",
        default: "{code}{alasan}",
        variabel: ["code", "alasan"],
        catatan:
          '{alasan} = " — alasan" (pemisah ikut di dalam token; kosong bila tanpa alasan)',
      },
    ],
  },
  {
    id: "push.selesai",
    grup: "Push",
    label: "Servis selesai",
    fields: [
      { name: "title", label: "Judul", default: "Servis selesai", variabel: [] },
      {
        name: "body",
        label: "Isi",
        default: "{code} — motor siap diambil",
        variabel: ["code"],
      },
    ],
  },
  {
    id: "push.stok",
    grup: "Push",
    label: "Stok menipis",
    fields: [
      { name: "title", label: "Judul", default: "Stok menipis", variabel: [] },
      {
        name: "body",
        label: "Isi",
        default: "{nama} tersisa {qty} {unit} (min {min_stok})",
        variabel: ["nama", "qty", "unit", "min_stok"],
      },
    ],
  },
  {
    id: "wa.pembatalan",
    grup: "WhatsApp",
    label: "Info pembatalan ke customer",
    fields: [
      {
        name: "body",
        label: "Pesan",
        default:
          "Halo, booking {code} di {appName} dibatalkan oleh bengkel.{alasan}\n" +
          "Mohon maaf atas ketidaknyamanannya — silakan booking ulang kapan saja.",
        variabel: ["code", "appName", "alasan"],
        catatan:
          '{alasan} = "\\nAlasan: …" (ikut baris baru; kosong bila tanpa alasan)',
      },
    ],
  },
  {
    id: "wa.jadwal_baru",
    grup: "WhatsApp",
    label: "Jadwal baru ke customer",
    fields: [
      {
        name: "body",
        label: "Pesan",
        default:
          "Halo, jadwal kedatangan booking {code} di {appName} diubah.\n" +
          "Jadwal baru: {jadwal}\n" +
          "Mohon dikonfirmasi bila berkenan. Terima kasih.",
        variabel: ["code", "appName", "jadwal"],
      },
    ],
  },
  {
    id: "wa.konfirmasi_booking",
    grup: "WhatsApp",
    label: "Konfirmasi booking (customer → bengkel)",
    fields: [
      {
        name: "body",
        label: "Pesan",
        default:
          "Halo {appName}, saya mau konfirmasi booking {code}." +
          "{motor}{layanan}{jadwal}",
        variabel: ["appName", "code", "motor", "layanan", "jadwal"],
        catatan:
          "{motor}/{layanan}/{jadwal} = baris lengkap diawali baris baru (kosong bila tidak ada)",
      },
    ],
  },
];

export function defaultTemplate(id: string, field: TemplateField): string {
  const def = TEMPLATE_DEFS.find((d) => d.id === id);
  return def?.fields.find((f) => f.name === field)?.default ?? "";
}

/** Ganti `{nama}` dengan nilai; token tanpa pasangan dibiarkan apa adanya. */
export function renderTemplate(
  tpl: string,
  vars: Record<string, string | number>,
): string {
  return tpl.replace(/\{(\w+)\}/g, (token, name) => {
    const v = vars[name];
    return v === undefined || v === null ? token : String(v);
  });
}

/**
 * Parse & bersihkan JSON override dari SystemSetting — entri tak dikenal,
 * tipe salah, kosong, atau melebihi batas dibuang (diamkan), bukan error.
 */
export function sanitasiTemplateOverrides(raw: string): TemplateOverrides {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: TemplateOverrides = {};
  for (const [id, fields] of Object.entries(parsed as Record<string, unknown>)) {
    if (!TEMPLATE_DEFS.some((d) => d.id === id)) continue;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
    for (const [name, value] of Object.entries(
      fields as Record<string, unknown>,
    )) {
      if (name !== "title" && name !== "body") continue;
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      const max = name === "title" ? TPL_TITLE_MAX : TPL_BODY_MAX;
      if (trimmed.length > max) continue;
      if (trimmed === defaultTemplate(id, name as TemplateField)) continue;
      out[id] = { ...out[id], [name]: trimmed };
    }
  }
  return out;
}

/**
 * Kumpulkan override dari input form (`tpl.<id>.<field>`) — nilai = default
 * atau kosong berarti kembali ke default (tidak disimpan).
 * Mengembalikan `error` bila ada nilai melebihi batas.
 */
export function kumpulkanTemplateDariForm(formData: FormData): {
  overrides?: TemplateOverrides;
  error?: string;
} {
  const overrides: TemplateOverrides = {};
  for (const def of TEMPLATE_DEFS) {
    for (const f of def.fields) {
      const value = String(formData.get(`tpl.${def.id}.${f.name}`) ?? "").trim();
      if (!value || value === f.default) continue;
      const max = f.name === "title" ? TPL_TITLE_MAX : TPL_BODY_MAX;
      if (value.length > max) {
        return {
          error: `Template "${def.label}" (${f.label}) maksimal ${max} karakter.`,
        };
      }
      overrides[def.id] = { ...overrides[def.id], [f.name]: value };
    }
  }
  return { overrides };
}
