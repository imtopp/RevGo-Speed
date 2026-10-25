"use client";

import { useId, useState } from "react";
import { cariPart, type PartCari } from "@/lib/part-search";

export type PartOpsi = PartCari & { unit: string };

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

/**
 * Pemilih part bercari: ketik nama/SKU/kategori → daftar tersaring instan.
 * Stok habis ditandai & tidak bisa dipilih (kecuali allowHabis — stok masuk/opname).
 * Enter memilih kandidat pertama lalu langsung submit form.
 */
export function PartPicker({
  parts,
  name = "partId",
  allowHabis = false,
  placeholder,
  onPick,
}: {
  parts: PartOpsi[];
  /** Nama field form; hidden input diisi id part terpilih. */
  name?: string;
  /** Izinkan pilih part stok 0 (restock/opname — justru part inilah yang dicari). */
  allowHabis?: boolean;
  placeholder?: string;
  /** Dipanggil tiap part dipilih (mis. auto-isi harga jual dari data part). */
  onPick?: (p: PartOpsi) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState("");

  const semua = cariPart(parts, query);
  const matches = semua.slice(0, 50);
  const selected = pickedId ? (parts.find((p) => p.id === pickedId) ?? null) : null;
  const bisaDipilih = (p: PartOpsi) => allowHabis || p.quantity > 0;
  const firstId = semua.find(bisaDipilih)?.id ?? "";

  const label = (p: PartOpsi) => `${p.name} · ${p.sku}`;

  function setNilai(id: string) {
    setPickedId(id);
  }

  function pilih(p: PartOpsi) {
    setNilai(p.id);
    setQuery(label(p));
    setOpen(false);
    onPick?.(p);
  }

  function ubahQuery(v: string) {
    setQuery(v);
    // Teks diedit setelah memilih → pilihan lama tidak berlaku lagi.
    if (selected && label(selected) !== v) setNilai("");
    setOpen(true);
  }

  function blur() {
    setOpen(false);
    // Ketikan yang mengenai tepat satu part (stok siap) → otomatis terpilih,
    // supaya tap "Simpan" setelah mengetik tidak mengirim partId kosong.
    if (!pickedId && query.trim()) {
      const cocok = semua.filter(bisaDipilih);
      if (cocok.length === 1) setNilai(cocok[0].id);
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={pickedId} readOnly />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Cari part"
        autoComplete="off"
        value={query}
        placeholder={placeholder ?? "Ketik nama / SKU part…"}
        onFocus={() => setOpen(true)}
        onBlur={blur}
        onChange={(e) => ubahQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key !== "Enter") return;
          // Sudah terpilih & teks sesuai → biarkan submit form biasa berjalan.
          if (selected && label(selected) === query) return;
          e.preventDefault();
          // Masih mengetik: ambil kandidat pertama, lalu submit.
          const first = semua.find(bisaDipilih);
          if (query.trim() && first) {
            pilih(first);
            e.currentTarget.form?.requestSubmit();
          }
        }}
        className={inputCls}
      />
      {open && (
        <ul
          id={listId}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Tidak ada part yang cocok.
            </li>
          )}
          {matches.map((p) => {
            const habis = p.quantity <= 0;
            const disabled = habis && !allowHabis;
            const aktif = p.id === pickedId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={disabled}
                  // Cegah blur sebelum click sempat terbaca.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pilih(p)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    aktif ? "bg-primary/10" : p.id === firstId ? "bg-slate-100" : ""
                  } ${disabled ? "opacity-50" : "hover:bg-slate-50"}`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {p.name}
                    <span className="text-slate-400"> · {p.sku}</span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      habis ? "font-semibold text-danger" : "text-slate-500"
                    }`}
                  >
                    {habis ? "HABIS" : `${p.quantity} ${p.unit}`}
                  </span>
                </button>
              </li>
            );
          })}
          {semua.length > matches.length && (
            <li className="px-3 py-2 text-xs text-slate-400">
              Menampilkan 50 dari {semua.length} — ketik untuk mempersempit.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
