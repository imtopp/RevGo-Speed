"use client";

import { useState } from "react";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export const bersihkan = (raw: string, izinMinus: boolean) => {
  const tanpa = raw.replace(/[^\d]/g, "");
  if (izinMinus && raw.includes("-")) return tanpa ? `-${tanpa}` : "-";
  return tanpa;
};

export const formatRibuan = (d: string) => {
  if (!d || d === "-") return d;
  const negatif = d.startsWith("-");
  const angka = negatif ? d.slice(1) : d;
  if (!angka) return "-";
  const ribuan = Number(angka).toLocaleString("id-ID");
  return negatif ? `-${ribuan}` : ribuan;
};

/**
 * Input angka berformat titik ribuan `150.000` selama diketik — form tetap
 * menerima string angka murni lewat hidden input (server `Number()` tidak
 * pernah melihat pemisah ribuan). Input tampil tanpa `name` sehingga hanya
 * hidden input yang terkirim; `required` tetap divalidasi browser saat submit.
 *
 * Dua mode:
 * - `defaultValue` → uncontrolled (state internal saja).
 * - `value` + `onChange(n: number)` → controlled, utk form yang menghitung
 *   nilai live (peringatan rugi, prefill katalog).
 * `allowNegative` utk field selisih (mis. stok opname −2).
 */
export function NumberInput({
  name,
  value,
  onChange,
  defaultValue,
  required = false,
  allowNegative = false,
  placeholder,
  className = inputCls,
}: {
  name: string;
  value?: number;
  onChange?: (n: number) => void;
  defaultValue?: number;
  required?: boolean;
  allowNegative?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const terkontrol = typeof value === "number";
  const [lokal, setLokal] = useState(() =>
    defaultValue ? formatRibuan(String(defaultValue)) : ""
  );
  const tampil = terkontrol ? formatRibuan(value ? String(value) : "") : lokal;

  const handle = (raw: string) => {
    const d = bersihkan(raw, allowNegative);
    setLokal(formatRibuan(d));
    onChange?.(d && d !== "-" ? Number(d) : 0);
  };

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={placeholder ?? "0"}
        aria-label="Angka"
        value={tampil}
        onChange={(e) => handle(e.target.value)}
        className={className}
      />
      <input
        type="hidden"
        name={name}
        value={
          terkontrol
            ? value
              ? String(value)
              : ""
            : bersihkan(lokal, allowNegative)
        }
        readOnly
      />
    </>
  );
}
