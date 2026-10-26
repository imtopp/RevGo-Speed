"use client";

import { useActionState, useEffect, useState, useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPart,
  updatePart,
  deletePart,
  stockIn,
  adjustStock,
  correctStockCost,
  sellPart,
  createSupplier,
  updateSupplier,
  type StokState,
} from "./actions";
import { formatRupiah, formatTanggalPendek } from "@/lib/service-status";
import { totalPenjualan, labaPenjualan } from "@/lib/sale";
import { SubmitButton } from "@/components/submit-button";
import { PartPicker } from "@/components/part-picker";
import { NumberInput } from "@/components/number-input";

type Part = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  buyPrice: number;
  sellPrice: number;
  supplier: { nama: string } | null;
};
type Supplier = { id: string; nama: string; telepon: string | null; catatan: string | null; aktif: boolean };
type Movement = {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  cost: number | null;
  note: string | null;
  createdAt: Date;
  part: { name: string; unit: string };
  user: { name: string } | null;
  supplier: { nama: string } | null;
};
type Branch = { id: string; name: string };
type SaleRow = {
  id: string;
  code: string;
  method: string;
  note: string | null;
  soldAt: Date;
  items: {
    id: string;
    quantity: number;
    price: number;
    cost: number;
    part: { name: string; unit: string };
  }[];
};
type RiwayatPart = {
  id: string;
  name: string;
  unit: string;
  buyPrice: number;
  lastCost: number | null;
  lastCostAt: Date | null;
  lastNote: string | null;
} | null;

function Msg({ state }: { state: StokState }) {
  if (state.error)
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state.success)
    return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>;
  return null;
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const btnPrimary =
  "w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-foreground active:opacity-90";

/**
 * Input kategori dengan saran dari kategori yang sudah ada (datalist) —
 * pengguna tetap bebas menulis baru, tapi typo beda kapital jarang terjadi.
 */
function KategoriInput({
  kategoris,
  placeholder,
  defaultValue,
}: {
  kategoris: string[];
  placeholder?: string;
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <>
      <input
        name="category"
        list={id}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputCls}
      />
      <datalist id={id}>
        {kategoris.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </>
  );
}

function PartForm({
  branches,
  suppliers,
  activeBranchId,
  isLocked,
  kategoris,
  onSuccess,
}: {
  branches: Branch[];
  suppliers: Supplier[];
  activeBranchId: string | null;
  isLocked: boolean;
  kategoris: string[];
  onSuccess?: (msg: string) => void;
}) {
  const [state, action] = useActionState<StokState, FormData>(createPart, {});
  const [buyPrice, setBuyPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [stateSebelumnya, setStateSebelumnya] = useState(state);
  const rugi = sellPrice < buyPrice;
  const totalStokAwal = quantity * buyPrice;

  // Sukses → beri tahu panel induk (tutup blok + notif luar); gagal → form tetap.
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) onSuccess?.(state.success);
  }

  return (
    <form action={action} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">Tambah Part Baru</p>
      <Msg state={state} />
      {!isLocked && (
        <div>
          <label className="block text-sm font-medium text-foreground">Cabang</label>
          <select name="branchId" defaultValue={activeBranchId ?? ""} className={inputCls}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">SKU</label>
          <input
            name="sku"
            placeholder="Kosongkan → auto PART-0001"
            className={`${inputCls} uppercase`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Nama</label>
          <input name="name" required placeholder="Oli Mesin 1L" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Kategori</label>
          <KategoriInput kategoris={kategoris} placeholder="Oli" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Satuan</label>
          <input name="unit" defaultValue="pcs" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm font-medium text-foreground">Stok Awal</label>
          <NumberInput name="quantity" value={quantity} onChange={setQuantity} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Min. Stok</label>
          <NumberInput name="minStock" defaultValue={0} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Supplier</label>
          <select name="supplierId" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {suppliers.filter((s) => s.aktif).map((s) => (
              <option key={s.id} value={s.id}>{s.nama}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Harga Beli (Rp)</label>
          <NumberInput name="buyPrice" value={buyPrice} onChange={setBuyPrice} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Harga Jual (Rp)</label>
          <NumberInput name="sellPrice" value={sellPrice} onChange={setSellPrice} />
        </div>
      </div>
      {totalStokAwal > 0 && (
        <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          <label className="block text-sm font-medium text-foreground">Bayar Stok Awal</label>
          <select name="method" defaultValue="CASH" className={inputCls}>
            <option value="CASH">Tunai (Kas)</option>
            <option value="TRANSFER">Transfer (Bank)</option>
            <option value="QRIS">QRIS (Bank)</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Stok awal = belanja: otomatis catat kas keluar {formatRupiah(totalStokAwal)} (qty ×
            harga beli).
          </p>
        </div>
      )}
      {rugi && (
        <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
          <p className="text-xs font-medium text-amber-800">
            ⚠ Harga jual {formatRupiah(sellPrice)} lebih murah dari harga beli{" "}
            {formatRupiah(buyPrice)} — rugi {formatRupiah(buyPrice - sellPrice)} per unit.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-amber-800">
            <input type="checkbox" name="confirmLoss" className="mt-0.5 h-4 w-4" />
            Saya paham dan sengaja menjual di bawah harga beli.
          </label>
        </div>
      )}
      <SubmitButton pendingText="Menyimpan..." className={btnPrimary}>
        Tambah Part
      </SubmitButton>
    </form>
  );
}

function StockInForm({
  parts,
  suppliers,
  onSuccess,
}: {
  parts: Part[];
  suppliers: Supplier[];
  onSuccess?: (msg: string) => void;
}) {
  const [state, action] = useActionState<StokState, FormData>(stockIn, {});
  const [stateSebelumnya, setStateSebelumnya] = useState(state);

  // Sukses → beri tahu panel induk (tutup blok + notif luar); gagal → form tetap.
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) onSuccess?.(state.success);
  }

  return (
    <form action={action} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">Stok Masuk (Pembelian)</p>
      <Msg state={state} />
      <div>
        <label className="block text-sm font-medium text-foreground">Part</label>
        <PartPicker parts={parts} allowHabis />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Jumlah</label>
          <NumberInput name="quantity" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Harga Beli /unit (Rp)</label>
          <NumberInput name="buyPrice" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Supplier</label>
          <select name="supplierId" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {suppliers.filter((s) => s.aktif).map((s) => (
              <option key={s.id} value={s.id}>{s.nama}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Bayar</label>
          <select name="method" defaultValue="CASH" className={inputCls}>
            <option value="CASH">Tunai (Kas)</option>
            <option value="TRANSFER">Transfer (Bank)</option>
            <option value="QRIS">QRIS (Bank)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">Catatan</label>
        <input name="note" placeholder="PO-001" className={inputCls} />
      </div>
      <p className="text-xs text-slate-400">
        Otomatis catat kas keluar sesuai total (qty × harga beli).
      </p>
      <SubmitButton pendingText="Menyimpan..." className={btnPrimary}>
        Catat Stok Masuk
      </SubmitButton>
    </form>
  );
}

function SellForm({ parts }: { parts: Part[] }) {
  const [state, action] = useActionState<StokState, FormData>(sellPart, {});
  const [picked, setPicked] = useState<Part | null>(null);
  const [qty, setQty] = useState(1);
  const [pesan, setPesan] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [stateSebelumnya, setStateSebelumnya] = useState(state);
  const total = qty * (picked?.sellPrice ?? 0);

  // Sukses → notif luar + reset isi form (remount via key); gagal → form tetap.
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) {
      setPesan(state.success);
      setResetKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 5000);
    return () => clearTimeout(t);
  }, [pesan]);

  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{pesan}</p>
      )}
      <form key={resetKey} action={action} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">
        Jual Part (Tanpa Servis)
      </p>
      <Msg state={state} />
      <div>
        <label className="block text-sm font-medium text-foreground">Part</label>
        <PartPicker
          parts={parts}
          placeholder="Ketik nama / SKU part (stok siap)…"
          onPick={(p) => setPicked(parts.find((x) => x.id === p.id) ?? null)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Jumlah</label>
          <NumberInput name="quantity" value={qty} onChange={setQty} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Harga Jual /unit (Rp)
          </label>
          <p
            className={`mt-1 rounded-lg border px-3 py-2 text-sm ${
              picked
                ? "border-slate-200 bg-slate-50 text-foreground"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            {picked ? formatRupiah(picked.sellPrice) : "Ikut data part"}
            {picked && <span className="text-slate-400"> · dari data part</span>}
          </p>
        </div>
      </div>
      {picked && qty > 0 && (
        <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground">
          Total:{" "}
          <b className="text-primary">{formatRupiah(total)}</b>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Bayar</label>
          <select name="method" defaultValue="CASH" className={inputCls}>
            <option value="CASH">Tunai (Kas)</option>
            <option value="TRANSFER">Transfer (Bank)</option>
            <option value="QRIS">QRIS (Bank)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Catatan</label>
          <input name="note" placeholder="Opsional" className={inputCls} />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Harga jual otomatis dari data part. Otomatis: stok berkurang (FIFO),
        kas masuk sesuai total, masuk laporan.
      </p>
      <SubmitButton pendingText="Mencatat..." className={btnPrimary}>
        Catat Penjualan
      </SubmitButton>
    </form>
    </div>
  );
}

function AdjustForm({
  parts,
  onSuccess,
}: {
  parts: Part[];
  onSuccess?: (msg: string) => void;
}) {
  const [state, action] = useActionState<StokState, FormData>(adjustStock, {});
  const [stateSebelumnya, setStateSebelumnya] = useState(state);

  // Sukses → beri tahu panel induk (tutup blok + notif luar); gagal → form tetap.
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) onSuccess?.(state.success);
  }

  return (
    <form action={action} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">Penyesuaian Stok</p>
      <Msg state={state} />
      <div>
        <label className="block text-sm font-medium text-foreground">Part</label>
        <PartPicker parts={parts} allowHabis />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">
          Selisih (+ tambah / − kurang)
        </label>
        <NumberInput name="delta" required allowNegative placeholder="-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">Alasan *</label>
        <input name="reason" required placeholder="Opname fisik, rusak, hilang" className={inputCls} />
      </div>
      <SubmitButton className={btnSecondary}>
        Terapkan Penyesuaian
      </SubmitButton>
    </form>
  );
}

function SupplierPanel({ suppliers }: { suppliers: Supplier[] }) {
  const [createState, createAction] = useActionState<StokState, FormData>(createSupplier, {});
  const [editId, setEditId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [stateSebelumnya, setStateSebelumnya] = useState(createState);

  // Sukses → notif luar + reset isi form (remount via key); gagal → form tetap.
  if (createState !== stateSebelumnya) {
    setStateSebelumnya(createState);
    if (createState.success) {
      setPesan(createState.success);
      setResetKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 5000);
    return () => clearTimeout(t);
  }, [pesan]);

  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{pesan}</p>
      )}
      <form key={resetKey} action={createAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <p className="text-sm font-semibold text-foreground">Tambah Supplier</p>
        {createState.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {createState.error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-foreground">Nama</label>
            <input name="nama" required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Telepon</label>
            <input name="telepon" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Catatan</label>
            <input name="catatan" className={inputCls} />
          </div>
        </div>
        <SubmitButton className={btnPrimary}>Tambah Supplier</SubmitButton>
      </form>

      <div className="space-y-2">
        {suppliers.length === 0 && (
          <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">Belum ada supplier.</p>
          </div>
        )}
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{s.nama}</p>
                <p className="text-sm text-muted-foreground">{s.telepon ?? "—"}</p>
                <p className="text-xs text-slate-400">{s.aktif ? "Aktif" : "Nonaktif"}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditId(editId === s.id ? null : s.id)}
                className="text-sm font-medium text-foreground underline underline-offset-2"
              >
                {editId === s.id ? "Tutup" : "Ubah"}
              </button>
            </div>
            {editId === s.id && <SupplierEdit supplier={s} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SupplierEdit({ supplier }: { supplier: Supplier }) {
  const [state, action] = useActionState<StokState, FormData>(updateSupplier, {});
  return (
    <form action={action} className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <input type="hidden" name="id" value={supplier.id} />
      <Msg state={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Nama</label>
          <input name="nama" defaultValue={supplier.nama} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Telepon</label>
          <input name="telepon" defaultValue={supplier.telepon ?? ""} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Catatan</label>
          <input name="catatan" defaultValue={supplier.catatan ?? ""} className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input type="checkbox" name="aktif" defaultChecked={supplier.aktif} />
        Aktif
      </label>
      <SubmitButton className={btnSecondary}>Simpan</SubmitButton>
    </form>
  );
}

function PartRow({ part, kategoris }: { part: Part; kategoris: string[] }) {
  const [open, setOpen] = useState(false);
  const [delState, delAction] = useActionState<StokState, FormData>(
    deletePart,
    {},
  );
  const low = part.quantity <= part.minStock;
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {part.name}
            {low && <span className="ml-2 text-xs text-amber-600">⚠ menipis</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {part.sku} · stok {part.quantity} {part.unit} (min {part.minStock})
          </p>
          <p className="text-xs text-slate-400">
            Jual {formatRupiah(part.sellPrice)}
            {part.supplier ? ` · ${part.supplier.nama}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-medium text-foreground underline underline-offset-2"
          >
            {open ? "Tutup" : "Ubah"}
          </button>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  `Hapus part "${part.name}"? Hanya bisa bila belum pernah dipakai.`,
                )
              )
                e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={part.id} />
            <button
              type="submit"
              className="text-xs font-medium text-danger underline underline-offset-2"
            >
              Hapus
            </button>
          </form>
        </div>
      </div>
      {delState.error && (
        <p className="mt-2 text-xs text-danger">{delState.error}</p>
      )}
      {open && <PartEdit part={part} kategoris={kategoris} />}
    </div>
  );
}

function PartEdit({ part, kategoris }: { part: Part; kategoris: string[] }) {
  const [state, action] = useActionState<StokState, FormData>(updatePart, {});
  const [sellPrice, setSellPrice] = useState(part.sellPrice);
  const rugi = sellPrice < part.buyPrice;
  return (
    <form action={action} className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <input type="hidden" name="id" value={part.id} />
      <Msg state={state} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Nama</label>
          <input name="name" defaultValue={part.name} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Kategori</label>
          <KategoriInput kategoris={kategoris} defaultValue={part.category ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Satuan</label>
          <input name="unit" defaultValue={part.unit} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Min. Stok</label>
          <NumberInput name="minStock" defaultValue={part.minStock} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Harga Beli (Rp)</label>
          <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-base text-slate-600">
            {formatRupiah(part.buyPrice)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Otomatis rata-rata pembelian — koreksi per batch lewat tab Riwayat.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Harga Jual (Rp)</label>
          <NumberInput name="sellPrice" value={sellPrice} onChange={setSellPrice} />
        </div>
      </div>
      {rugi && (
        <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
          <p className="text-xs font-medium text-amber-800">
            ⚠ Harga jual {formatRupiah(sellPrice)} lebih murah dari harga beli{" "}
            {formatRupiah(part.buyPrice)} (rata-rata) — rugi{" "}
            {formatRupiah(part.buyPrice - sellPrice)} per unit.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-amber-800">
            <input type="checkbox" name="confirmLoss" className="mt-0.5 h-4 w-4" />
            Saya paham dan sengaja menjual di bawah harga beli.
          </label>
        </div>
      )}
      <SubmitButton className={btnSecondary}>Simpan</SubmitButton>
    </form>
  );
}

// ── Panel utama ───────────────────────────────────────────────────────

function CostEdit({ movementId, cost }: { movementId: string; cost: number }) {
  const [state, action] = useActionState<StokState, FormData>(correctStockCost, {});
  return (
    <form action={action} className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <input type="hidden" name="movementId" value={movementId} />
      <Msg state={state} />
      <div>
        <label className="block text-xs font-medium text-muted-foreground">
          Harga beli batch yang benar (Rp)
        </label>
        <NumberInput name="cost" defaultValue={cost} required />
      </div>
      <p className="text-xs text-amber-600">
        Koreksi otomatis: riwayat batch, rata-rata, dan HPP servis yang unitnya
        terpakai dari batch ini saja. Kas dikoreksi bertanggal pembelian hanya
        bila pembeliannya tercatat di kas. Harga jual tidak berubah.
      </p>
      <SubmitButton pendingText="Mengoreksi..." className={btnSecondary}>
        Koreksi Harga Beli
      </SubmitButton>
    </form>
  );
}

function MovementRow({ m }: { m: Movement }) {
  const [open, setOpen] = useState(false);
  const canCorrect = m.type === "IN" && m.cost !== null;
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-slate-200 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <span className={m.type === "IN" ? "text-success" : "text-danger"}>
              {m.type === "IN" ? "+" : "−"}
              {m.quantity}
            </span>{" "}
            {m.part.name}
            {m.cost !== null && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                @{formatRupiah(m.cost)}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {m.note ?? "—"}
            {m.supplier ? ` · ${m.supplier.nama}` : ""}
            {m.user ? ` · ${m.user.name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-slate-400">
            {formatTanggalPendek(m.createdAt)}
          </span>
          {canCorrect && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs font-medium text-foreground underline underline-offset-2"
            >
              {open ? "Tutup" : "Koreksi"}
            </button>
          )}
        </div>
      </div>
      {open && m.cost !== null && (
        <CostEdit movementId={m.id} cost={m.cost} />
      )}
    </div>
  );
}

export function StokPanels({
  tab,
  parts,
  suppliers,
  movements,
  branches,
  activeBranchId,
  isLockedBranch,
  riwayatPart,
  kategoris,
  sales,
}: {
  tab: string;
  parts: Part[];
  suppliers: Supplier[];
  movements: Movement[];
  branches: Branch[];
  activeBranchId: string | null;
  isLockedBranch: boolean;
  riwayatPart: RiwayatPart;
  kategoris: string[];
  sales: SaleRow[];
}) {
  const [showForms, setShowForms] = useState(false);
  const [aksi, setAksi] = useState<"part" | "masuk" | "opname">("part");
  const [pesan, setPesan] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [katPilih, setKatPilih] = useState("");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Notif sukses dari form aksi stok — tampil di luar blok, hilang 5 detik.
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 5000);
    return () => clearTimeout(t);
  }, [pesan]);

  if (tab === "supplier") {
    return <SupplierPanel suppliers={suppliers} />;
  }

  if (tab === "jual") {
    return (
      <div className="space-y-3">
        <SellForm parts={parts} />
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm font-semibold text-foreground">
            Riwayat Penjualan Part
          </p>
          {sales.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Belum ada penjualan.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {sales.map((s) => {
                const total = totalPenjualan(s.items);
                const laba = labaPenjualan(s.items);
                return (
                  <li key={s.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {s.code} · {s.method}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTanggalPendek(s.soldAt)}
                          {s.note ? ` · ${s.note}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-medium">{formatRupiah(total)}</p>
                        <p
                          className={`text-xs ${laba < 0 ? "text-danger" : "text-slate-400"}`}
                        >
                          laba {formatRupiah(laba)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {s.items
                        .map((i) => `${i.quantity} ${i.part.unit} ${i.part.name}`)
                        .join(", ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (tab === "riwayat") {
    const branchQ = activeBranchId ? `&branch=${activeBranchId}` : "";
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            Fokus ke part
          </label>
          <select
            value={riwayatPart?.id ?? ""}
            disabled={isPending}
            aria-busy={isPending}
            onChange={(e) => {
              const value = e.target.value;
              startTransition(() => {
                router.push(
                  `/dashboard/stok?tab=riwayat${value ? `&part=${value}` : ""}${branchQ}`,
                );
              });
            }}
            className={`mt-1 w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-base outline-none disabled:opacity-60 ${
              isPending ? "animate-pulse" : ""
            }`}
          >
            <option value="">Semua part</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {riwayatPart && (
          <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
            <p className="font-medium">{riwayatPart.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Harga rata-rata:{" "}
              <span className="font-semibold text-foreground">
                {formatRupiah(riwayatPart.buyPrice)}
              </span>
            </p>
            {riwayatPart.lastCost !== null && (
              <p className="text-sm text-muted-foreground">
                Harga beli batch terakhir:{" "}
                <span className="font-semibold text-foreground">
                  {formatRupiah(riwayatPart.lastCost)}
                </span>{" "}
                {riwayatPart.lastCostAt &&
                  `· ${formatTanggalPendek(riwayatPart.lastCostAt)}`}
              </p>
            )}
          </div>
        )}

        {movements.length === 0 && (
          <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">Belum ada pergerakan stok.</p>
          </div>
        )}
        {movements.map((m) => (
          <MovementRow key={m.id} m={m} />
        ))}
      </div>
    );
  }

  // Tab part (default) — filter klien: cari nama/SKU/kategori + kategori.
  const q = cari.trim().toLowerCase();
  const partsTampil = parts.filter((p) => {
    const cocokQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q);
    const cocokKat = !katPilih || p.category === katPilih;
    return cocokQ && cocokKat;
  });

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowForms((v) => !v)}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-90"
      >
        {showForms ? "Tutup Aksi Stok" : "+ Aksi Stok"}
      </button>

      {pesan && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{pesan}</p>
      )}

      {showForms && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 ring-1 ring-slate-200 shadow-card">
            {(
              [
                ["part", "Tambah Part"],
                ["masuk", "Stok Masuk"],
                ["opname", "Opname"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAksi(key)}
                className={`rounded-lg px-2 py-2 text-xs font-medium active:opacity-90 sm:text-sm ${
                  aksi === key
                    ? "bg-primary text-white"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {aksi === "part" && (
            <PartForm
              branches={branches}
              suppliers={suppliers}
              activeBranchId={activeBranchId}
              isLocked={isLockedBranch}
              kategoris={kategoris}
              onSuccess={(m) => {
                setShowForms(false);
                setPesan(m);
              }}
            />
          )}
          {aksi === "masuk" && (
            <StockInForm
              parts={parts}
              suppliers={suppliers}
              onSuccess={(m) => {
                setShowForms(false);
                setPesan(m);
              }}
            />
          )}
          {aksi === "opname" && (
            <AdjustForm
              parts={parts}
              onSuccess={(m) => {
                setShowForms(false);
                setPesan(m);
              }}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        {parts.length === 0 && (
          <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">
              Belum ada part. Tambah lewat &quot;+ Aksi Stok&quot;.
            </p>
          </div>
        )}
        {parts.length > 0 && (
          <div className="rounded-xl bg-surface p-3 ring-1 ring-slate-200 shadow-card">
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama / SKU / kategori…"
              className={inputCls}
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                value={katPilih}
                onChange={(e) => setKatPilih(e.target.value)}
                className={`${inputCls} min-w-0 flex-1`}
              >
                <option value="">Semua kategori</option>
                {kategoris.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <p className="shrink-0 text-xs text-muted-foreground">
                {partsTampil.length} dari {parts.length} part
              </p>
            </div>
          </div>
        )}
        {parts.length > 0 && partsTampil.length === 0 && (
          <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">
              Part tidak ditemukan untuk pencarian ini.
            </p>
          </div>
        )}
        {partsTampil.map((p) => (
          <PartRow key={p.id} part={p} kategoris={kategoris} />
        ))}
      </div>
    </div>
  );
}
