"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white"
    >
      🖨 Cetak Nota
    </button>
  );
}
