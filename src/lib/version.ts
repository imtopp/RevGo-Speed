export type VersionEnv = {
  deploymentId?: string | undefined;
  commitSha?: string | undefined;
};

/** Hash pendek djb2 (base36) — deterministik, tetap unik antar commit. */
function hashPendek(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Versi build yang dipakai /api/version untuk memberi tahu client
 * bahwa deploy baru sudah tersedia (wayout: client selalu ikut update).
 * Prioritas: ID deployment (berubah tiap deploy) > SHA commit > fallback lokal.
 * Endpoint ini publik tanpa auth & repo publik — SHA mentah tidak ditampilkan
 * apa adanya; cukup hash pendeknya untuk deteksi perubahan.
 */
export function resolveVersion(env: VersionEnv, fallback: string): string {
  const deployment = env.deploymentId?.trim();
  if (deployment) return deployment;
  const sha = env.commitSha?.trim();
  if (sha) return hashPendek(sha);
  return fallback;
}
