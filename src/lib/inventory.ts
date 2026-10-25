/**
 * Rata-rata tertimbang harga beli (moving average).
 * Dipakai saat stok masuk: buyPrice part = rata-rata sisa stok.
 */
export function movingAverageBuyPrice(
  qtyLama: number,
  avgLama: number,
  qtyBaru: number,
  hargaBaru: number,
): number {
  if (qtyBaru <= 0) return avgLama;
  const totalQty = qtyLama + qtyBaru;
  if (qtyLama <= 0) return hargaBaru;
  return Math.round((qtyLama * avgLama + qtyBaru * hargaBaru) / totalQty);
}

/**
 * Estimasi rata-rata baru setelah koreksi harga beli satu batch (StockMovement.cost).
 * Dampak hanya untuk unit batch yang MASIH ADA di stok: `qtyBatch − qtyTerpakai`
 * (jejak PartBatchUsage) — batch yang sudah habis terpakai tidak menarik rata-rata.
 * Aproksimasi: pemakaian di luar servis (penyesuaian) tidak terjejak per batch,
 * jadi porsi dibatasi stok saat ini.
 */
export function estimateAvgAfterCostCorrection(
  qtyBatch: number,
  qtyTerpakai: number,
  costLama: number,
  costBaru: number,
  avgSekarang: number,
  qtySekarang: number,
): number {
  if (qtySekarang <= 0) return avgSekarang;
  const porsiMasihAda = Math.min(Math.max(qtyBatch - qtyTerpakai, 0), qtySekarang);
  const dampakTotal = porsiMasihAda * (costBaru - costLama);
  return Math.max(0, Math.round(avgSekarang + dampakTotal / qtySekarang));
}

export type OpenBatch = {
  movementId: string;
  /** Sisa unit batch ini yang belum terpakai (qty batch − alokasi). */
  remaining: number;
  /** Harga beli batch; null → pakai fallbackCost. */
  cost: number | null;
};

export type BatchAllocation = { movementId: string; quantity: number };

/**
 * Alokasi FIFO: `need` unit diambil dari batch tertua yang masih sisa.
 * Sisa yang tidak terjangkau batch manapun dihitung dengan `fallbackCost`
 * (rata-rata part) — tercatat sebagai pemakaian tanpa jejak batch.
 */
export function allocateFifo(
  need: number,
  batches: OpenBatch[],
  fallbackCost: number,
): { allocations: BatchAllocation[]; cost: number; unmatchedQty: number } {
  const allocations: BatchAllocation[] = [];
  let sisa = Math.max(0, Math.floor(need));
  let blendQty = 0;
  let blendSum = 0;

  for (const b of batches) {
    if (sisa <= 0) break;
    const ambil = Math.min(Math.max(b.remaining, 0), sisa);
    if (ambil <= 0) continue;
    allocations.push({ movementId: b.movementId, quantity: ambil });
    const c = b.cost ?? fallbackCost;
    blendQty += ambil;
    blendSum += ambil * c;
    sisa -= ambil;
  }

  if (sisa > 0) {
    blendQty += sisa;
    blendSum += sisa * fallbackCost;
  }
  const total = blendQty;
  const cost = total > 0 ? Math.round(blendSum / total) : fallbackCost;
  return { allocations, cost, unmatchedQty: sisa };
}

/**
 * Cost per-unit baru untuk satu baris servis setelah koreksi harga batch:
 * hanya porsi unit dari batch ikut ditarik delta (hargaBaru − hargaLama).
 */
export function correctedServiceCost(
  spCost: number,
  spQty: number,
  usageQty: number,
  costLama: number,
  costBaru: number,
): number {
  if (spQty <= 0 || usageQty <= 0 || costLama === costBaru) return spCost;
  const deltaTotal = usageQty * (costBaru - costLama);
  return Math.max(0, Math.round(spCost + deltaTotal / spQty));
}
