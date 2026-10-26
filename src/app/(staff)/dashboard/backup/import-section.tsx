"use client";

import { useRef, useState } from "react";

type Hasil = {
  ok: true;
  total: number;
  app: string;
  exportedAt: string;
  missingTables: string[];
  ignoredKeys: string[];
};

export function ImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [konfirmasi, setKonfirmasi] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const siap = !!file && konfirmasi === "RESTORE" && !busy && !hasil;

  async function handleImport() {
    if (!siap || !file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("konfirmasi", konfirmasi);
      const res = await fetch("/api/backup/import", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as
        | (Hasil & { error?: string })
        | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? `Gagal (HTTP ${res.status}).`);
      }
      setHasil(body);
      setTimeout(() => window.location.reload(), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setBusy(false);
    }
  }

  function handleReset() {
    setHasil(null);
    setFile(null);
    setKonfirmasi("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (hasil) {
    return (
      <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">
          Restore Selesai
        </h2>
        <p className="text-sm text-muted-foreground">
          Berhasil memulihkan <strong>{hasil.total} baris</strong> data
          {hasil.app ? ` (${hasil.app}` : ""}
          {hasil.exportedAt ? `, diekspor ${hasil.exportedAt.slice(0, 10)}` : ""})
          {hasil.app ? ")" : ""}. Halaman dimuat ulang…
        </p>
        {hasil.missingTables.length > 0 && (
          <p className="text-xs text-warning">
            Tabel tidak ada di file (diisi kosong): {hasil.missingTables.join(", ")}
          </p>
        )}
        {hasil.ignoredKeys.length > 0 && (
          <p className="text-xs text-warning">
            Bagian file tidak dikenal, diabaikan: {hasil.ignoredKeys.join(", ")}
          </p>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-foreground active:opacity-90"
        >
          Selesai
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-red-200 shadow-card">
      <h2 className="text-sm font-semibold text-foreground">
        Pulihkan dari File (Restore)
      </h2>
      <p className="text-sm text-muted-foreground">
        Ganti <strong>SELURUH data aplikasi</strong> dengan isi file backup:
        semua data sekarang (servis, stok, kas, akun) dihapus lalu diganti isi
        file — dalam satu transaksi. Jika gagal di tengah, data lama tetap
        utuh. Tidak bisa dibatalkan setelah sukses.
      </p>

      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground active:file:opacity-90"
        />
        <input
          type="text"
          value={konfirmasi}
          onChange={(e) => setKonfirmasi(e.target.value)}
          placeholder='Ketik "RESTORE" untuk konfirmasi'
          aria-label="Konfirmasi restore"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={handleImport}
          disabled={!siap}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white ${
            siap ? "active:opacity-90" : "cursor-not-allowed opacity-40"
          }`}
        >
          {busy && (
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
            />
          )}
          {busy ? "Memulihkan… (jangan tutup tab)" : "Pulihkan Sekarang"}
        </button>
        {error && (
          <p className="text-sm text-primary" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
