export type VersionEnv = {
  deploymentId?: string | undefined;
  commitSha?: string | undefined;
};

/**
 * Versi build yang dipakai /api/version untuk memberi tahu client
 * bahwa deploy baru sudah tersedia (wayout: client selalu ikut update).
 * Prioritas: ID deployment (berubah tiap deploy) > SHA commit > fallback lokal.
 */
export function resolveVersion(env: VersionEnv, fallback: string): string {
  const v = env.deploymentId?.trim() || env.commitSha?.trim() || "";
  return v || fallback;
}
