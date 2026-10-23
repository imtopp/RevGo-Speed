"use client";

import { useActionState, useState } from "react";
import {
  createPart,
  updatePart,
  stockIn,
  adjustStock,
  createSupplier,
  updateSupplier,
  type StokState,
} from "./actions";
import { formatRupiah, formatTanggalPendek } from "@/lib/service-status";

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

function Msg({ state }: { state: StokState }) {
  if (state.error)
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>;
  if (state.success)
    return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>;
  return null;
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const btnPrimary =
  "w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:opacity-90";

function PartForm({
  branches,
  suppliers,
  activeBranchId,
  isLocked,
}: {
  branches: Branch[];
  suppliers: Supplier[];
  activeBranchId: string | null;
  isLocked: boolean;
}) {
  const [state, action, pending] = useActionState<StokState, FormData>(createPart, {});
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-700">Tambah Part Baru</p>
      <Msg state={state} />
      {!isLocked && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Cabang</label>
          <select name="branchId" defaultValue={activeBranchId ?? ""} className={inputCls}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">SKU</label>
          <input name="sku" required placeholder="OLI-001" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nama</label>
          <input name="name" required placeholder="Oli Mesin 1L" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Kategori</label>
          <input name="category" placeholder="Oli" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Satuan</label>
          <input name="unit" defaultValue="pcs" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Stok Awal</label>
          <input name="quantity" type="number" min={0} defaultValue={0} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Min. Stok</label>
          <input name="minStock" type="number" min={0} defaultValue={0} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Supplier</label>
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
          <label className="block text-sm font-medium text-slate-700">Harga Beli (Rp)</label>
          <input name="buyPrice" type="number" min={0} defaultValue={0} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Harga Jual (Rp)</label>
          <input name="sellPrice" type="number" min={0} defaultValue={0} className={inputCls} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Menyimpan..." : "Tambah Part"}
      </button>
    </form>
  );
}

function StockInForm({ parts, suppliers }: { parts: Part[]; suppliers: Supplier[] }) {
  const [state, action, pending] = useActionState<StokState, FormData>(stockIn, {});
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-700">Stok Masuk (Pembelian)</p>
      <Msg state={state} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Part</label>
        <select name="partId" required className={inputCls}>
          <option value="">— Pilih —</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stok: {p.quantity})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Jumlah</label>
          <input name="quantity" type="number" min={1} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Harga Beli /unit (Rp)</label>
          <input name="buyPrice" type="number" min={0} required className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Supplier</label>
          <select name="supplierId" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {suppliers.filter((s) => s.aktif).map((s) => (
              <option key={s.id} value={s.id}>{s.nama}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Bayar</label>
          <select name="method" defaultValue="CASH" className={inputCls}>
            <option value="CASH">Tunai (Kas)</option>
            <option value="TRANSFER">Transfer (Bank)</option>
            <option value="QRIS">QRIS (Bank)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Catatan</label>
        <input name="note" placeholder="PO-001" className={inputCls} />
      </div>
      <p className="text-xs text-slate-400">
        Otomatis catat kas keluar sesuai total (qty × harga beli).
      </p>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Menyimpan..." : "Catat Stok Masuk"}
      </button>
    </form>
  );
}

function AdjustForm({ parts }: { parts: Part[] }) {
  const [state, action, pending] = useActionState<StokState, FormData>(adjustStock, {});
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-700">Penyesuaian Stok</p>
      <Msg state={state} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Part</label>
        <select name="partId" required className={inputCls}>
          <option value="">— Pilih —</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stok: {p.quantity})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Selisih (+ tambah / − kurang)
        </label>
        <input name="delta" type="number" required placeholder="-2" className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Alasan *</label>
        <input name="reason" required placeholder="Opname fisik, rusak, hilang" className={inputCls} />
      </div>
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "..." : "Terapkan Penyesuaian"}
      </button>
    </form>
  );
}

function SupplierPanel({ suppliers }: { suppliers: Supplier[] }) {
  const [createState, createAction, createPending] = useActionState<StokState, FormData>(createSupplier, {});
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <form action={createAction} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-700">Tambah Supplier</p>
        <Msg state={createState} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nama</label>
            <input name="nama" required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Telepon</label>
            <input name="telepon" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Catatan</label>
            <input name="catatan" className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={createPending} className={btnPrimary}>
          {createPending ? "..." : "Tambah Supplier"}
        </button>
      </form>

      <div className="space-y-2">
        {suppliers.length === 0 && (
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Belum ada supplier.</p>
          </div>
        )}
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{s.nama}</p>
                <p className="text-sm text-slate-500">{s.telepon ?? "—"}</p>
                <p className="text-xs text-slate-400">{s.aktif ? "Aktif" : "Nonaktif"}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditId(editId === s.id ? null : s.id)}
                className="text-sm font-medium text-slate-700 underline underline-offset-2"
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
  const [state, action, pending] = useActionState<StokState, FormData>(updateSupplier, {});
  return (
    <form action={action} className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <input type="hidden" name="id" value={supplier.id} />
      <Msg state={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nama</label>
          <input name="nama" defaultValue={supplier.nama} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Telepon</label>
          <input name="telepon" defaultValue={supplier.telepon ?? ""} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Catatan</label>
          <input name="catatan" defaultValue={supplier.catatan ?? ""} className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="aktif" defaultChecked={supplier.aktif} />
        Aktif
      </label>
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "..." : "Simpan"}
      </button>
    </form>
  );
}

function PartRow({ part }: { part: Part }) {
  const [open, setOpen] = useState(false);
  const low = part.quantity <= part.minStock;
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {part.name}
            {low && <span className="ml-2 text-xs text-amber-600">⚠ menipis</span>}
          </p>
          <p className="text-sm text-slate-500">
            {part.sku} · stok {part.quantity} {part.unit} (min {part.minStock})
          </p>
          <p className="text-xs text-slate-400">
            Jual {formatRupiah(part.sellPrice)}
            {part.supplier ? ` · ${part.supplier.nama}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-sm font-medium text-slate-700 underline underline-offset-2"
        >
          {open ? "Tutup" : "Ubah"}
        </button>
      </div>
      {open && <PartEdit part={part} />}
    </div>
  );
}

function PartEdit({ part }: { part: Part }) {
  const [state, action, pending] = useActionState<StokState, FormData>(updatePart, {});
  return (
    <form action={action} className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <input type="hidden" name="id" value={part.id} />
      <Msg state={state} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nama</label>
          <input name="name" defaultValue={part.name} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Kategori</label>
          <input name="category" defaultValue={part.category ?? ""} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Satuan</label>
          <input name="unit" defaultValue={part.unit} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Min. Stok</label>
          <input name="minStock" type="number" min={0} defaultValue={part.minStock} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Harga Beli</label>
          <input name="buyPrice" type="number" min={0} defaultValue={part.buyPrice} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Harga Jual</label>
          <input name="sellPrice" type="number" min={0} defaultValue={part.sellPrice} className={inputCls} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "..." : "Simpan"}
      </button>
    </form>
  );
}

// ── Panel utama ───────────────────────────────────────────────────────

export function StokPanels({
  tab,
  parts,
  suppliers,
  movements,
  branches,
  activeBranchId,
  isLockedBranch,
}: {
  tab: string;
  parts: Part[];
  suppliers: Supplier[];
  movements: Movement[];
  branches: Branch[];
  activeBranchId: string | null;
  isLockedBranch: boolean;
}) {
  const [showForms, setShowForms] = useState(false);

  if (tab === "supplier") {
    return <SupplierPanel suppliers={suppliers} />;
  }

  if (tab === "riwayat") {
    return (
      <div className="space-y-2">
        {movements.length === 0 && (
          <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Belum ada pergerakan stok.</p>
          </div>
        )}
        {movements.map((m) => (
          <div key={m.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className={m.type === "IN" ? "text-emerald-600" : "text-red-600"}>
                    {m.type === "IN" ? "+" : "−"}
                    {m.quantity}
                  </span>{" "}
                  {m.part.name}
                </p>
                <p className="text-xs text-slate-500">
                  {m.note ?? "—"}
                  {m.supplier ? ` · ${m.supplier.nama}` : ""}
                  {m.user ? ` · ${m.user.name}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {formatTanggalPendek(m.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Tab part (default)
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowForms((v) => !v)}
          className={btnSecondary}
        >
          {showForms ? "Tutup" : "+ Aksi Stok"}
        </button>
      </div>

      {showForms && (
        <div className="space-y-3">
          <PartForm
            branches={branches}
            suppliers={suppliers}
            activeBranchId={activeBranchId}
            isLocked={isLockedBranch}
          />
          <StockInForm parts={parts} suppliers={suppliers} />
          <AdjustForm parts={parts} />
        </div>
      )}

      <div className="space-y-2">
        {parts.length === 0 && (
          <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Belum ada part. Tambah lewat &quot;+ Aksi Stok&quot;.
            </p>
          </div>
        )}
        {parts.map((p) => (
          <PartRow key={p.id} part={p} />
        ))}
      </div>
    </div>
  );
}
