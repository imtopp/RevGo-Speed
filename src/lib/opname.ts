export const OPNAME_NOTE_PREFIX = "Penyesuaian:";

export function isOpnameNote(note: string | null): boolean {
  return (note ?? "").trimStart().startsWith(OPNAME_NOTE_PREFIX);
}

export type OpnameMovement = {
  type: "IN" | "OUT";
  quantity: number;
  unitCost: number;
};

/**
 * Nilai selisih opname periode (Rupiah, signed).
 * IN (stok lebih) → positif; OUT (stok kurang) → negatif.
 * unitCost memakai buyPrice part — tidak memengaruhi sellPrice/harga jual.
 */
export function opnameDeltaValue(movements: OpnameMovement[]): number {
  return movements.reduce(
    (sum, m) => sum + (m.type === "IN" ? 1 : -1) * m.quantity * m.unitCost,
    0,
  );
}
