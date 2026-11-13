export type MerekGroup = { label: string; items: string[] };

export const MEREK_GROUPS: MerekGroup[] = [
  { label: "Jepang", items: ["Honda", "Yamaha", "Suzuki", "Kawasaki"] },
  { label: "India & Taiwan", items: ["TVS", "Bajaj", "Kymco"] },
  {
    label: "Eropa & Amerika",
    items: [
      "Vespa",
      "Piaggio",
      "BMW",
      "KTM",
      "Ducati",
      "Triumph",
      "Aprilia",
      "Moto Guzzi",
      "Royal Enfield",
      "Harley-Davidson",
      "Benelli",
    ],
  },
  {
    label: "Lokal & Cina",
    items: ["Viar", "Zontes", "CFMoto", "Voge", "Minerva", "Motobi", "Kaisar"],
  },
  {
    label: "Listrik",
    items: [
      "Gesits",
      "Alva",
      "Polytron",
      "United",
      "Yadea",
      "Sunra",
      "Keeway",
      "Volta",
      "Selis",
    ],
  },
];

export const MEREK_LAINNYA = "Lainnya";

const MODEL_PER_MEREK: Record<string, string[]> = {
  Honda: [
    "Beat",
    "Vario",
    "Scoopy",
    "PCX",
    "ADV",
    "Stylo",
    "Supra X",
    "Revo",
    "CB150R",
    "CBR150R",
    "CRF150L",
  ],
  Yamaha: [
    "Mio",
    "NMAX",
    "Aerox",
    "Fino",
    "Freego",
    "X-Ride",
    "Fazzio",
    "Vixion",
    "R15",
    "Jupiter",
    "MX King",
  ],
  Suzuki: ["Satria", "Nex", "Address", "GSX-R150", "Smash"],
  Kawasaki: ["Ninja 250", "W175", "KLX150", "Z250"],
  TVS: ["Apache", "Ntorq"],
  Vespa: ["Primavera", "Sprint"],
  Bajaj: ["Pulsar"],
  Viar: ["Cross X"],
};

type ModelRow = { brand: string; model: string };

export function buildModelPerMerek(rows: ModelRow[]): Record<string, string[]> {
  const hasil: Record<string, string[]> = {};
  const terpakai: Record<string, Set<string>> = {};
  const tambah = (merek: string, tipe: string) => {
    const kunci = merek.toLowerCase();
    const t = tipe.trim();
    if (!t) return;
    if (!terpakai[kunci]) {
      terpakai[kunci] = new Set();
      hasil[merek] = [];
    }
    if (terpakai[kunci].has(t.toLowerCase())) return;
    terpakai[kunci].add(t.toLowerCase());
    hasil[merek].push(t);
  };
  for (const [merek, list] of Object.entries(MODEL_PER_MEREK)) {
    for (const t of list) tambah(merek, t);
  }
  for (const r of rows) {
    if (modelTidakSesuaiMerek(r.brand, r.model)) continue;
    tambah(normalizeMerek(r.brand), r.model);
  }
  return hasil;
}

export function flattenModel(record: Record<string, string[]>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of Object.values(record)) {
    for (const m of list) {
      const k = m.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
  }
  return out;
}

export function modelTidakSesuaiMerek(brand: string, model: string): boolean {
  const m = collapseSpace(model).toLowerCase();
  if (!m) return false;
  const b = normalizeMerek(brand);
  const daftar = MODEL_PER_MEREK[b];
  if (!daftar) return false;
  if (daftar.some((t) => t.toLowerCase() === m)) return false;
  for (const [merekLain, list] of Object.entries(MODEL_PER_MEREK)) {
    if (merekLain === b) continue;
    if (list.some((t) => t.toLowerCase() === m)) return true;
  }
  return false;
}

const MEREK_CANONICAL: string[] = MEREK_GROUPS.flatMap((g) => g.items);

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function normalizeMerek(input: string): string {
  const t = collapseSpace(input);
  if (!t) return t;
  const found = MEREK_CANONICAL.find((m) => m.toLowerCase() === t.toLowerCase());
  return found ?? titleCase(t);
}

export function normalizeTipe(input: string): string {
  return collapseSpace(input);
}

export function merekDikenal(brand: string): boolean {
  const t = collapseSpace(brand).toLowerCase();
  return !!t && MEREK_CANONICAL.some((m) => m.toLowerCase() === t);
}

const PLATE_RE = /^([A-Z]{1,4})\s*(\d{1,4})\s*([A-Z]{1,3})?$/;

export function normalizePlate(raw: string): string | null {
  const t = collapseSpace(raw).toUpperCase();
  const m = PLATE_RE.exec(t);
  if (!m) return null;
  return m[3] ? `${m[1]} ${m[2]} ${m[3]}` : `${m[1]} ${m[2]}`;
}

/** Label group motor listrik di dropdown merek (bisa disembunyikan per instance). */
export const MEREK_LISTRIK_LABEL = "Listrik";

const EV_MEREK = new Set(
  MEREK_GROUPS.find((g) => g.label === MEREK_LISTRIK_LABEL)?.items ?? [],
);

/**
 * Group merek untuk dropdown — dipanggil dari halaman server, hasilnya
 * di-pass sebagai prop ke form client. Bila `HIDE_EV_MEREK=true` (env per
 * instance, mis. bengkel yang tidak menangani motor listrik), group Listrik
 * dibuang. Default: semua group tampil.
 */
export function merekGroupsTampil(): MerekGroup[] {
  if (process.env.HIDE_EV_MEREK !== "true") return MEREK_GROUPS;
  return MEREK_GROUPS.filter((g) => g.label !== MEREK_LISTRIK_LABEL);
}

/**
 * Penegakan server-side saat `HIDE_EV_MEREK=true`: tolak input merek listrik
 * yang tetap masuk lewat POST manual / opsi "Lainnya" yang mengetik merek EV.
 */
export function merekListrikDilarang(brand: string): boolean {
  if (process.env.HIDE_EV_MEREK !== "true") return false;
  return EV_MEREK.has(normalizeMerek(brand));
}
