/**
 * Pemicu build ulang Vercel untuk fitur Update.
 *
 * Vercel melewatkan webhook push ketika commit target sudah pernah punya
 * deployment (kasus rollback / tarik-ulang ke sha lama) — ref channel
 * berpindah tapi situs tetap di kode lama. Setelah ref dipindah, modul
 * ini memastikan SHA target benar-benar dibangun ulang lewat Vercel API.
 * Hanya dipanggil dari server; token tidak pernah sampai ke client.
 */

const API = "https://api.vercel.com";

export type VercelDeployResult =
  | { status: "redeployed"; deploymentId: string }
  | { status: "in-progress"; deploymentId: string }
  | { status: "new-sha" }
  | { status: "skipped" }
  | { status: "failed"; error: string };

type DeploymentListItem = {
  uid?: unknown;
  name?: unknown;
  readyState?: unknown;
  target?: unknown;
  meta?: { githubCommitSha?: unknown };
};

export type EnsureDeployOptions = {
  token: string;
  projectId: string;
  teamId: string;
  targetSha: string;
  fetchImpl?: typeof fetch;
};

const BUILDING_STATES = new Set(["QUEUED", "BUILDING", "INITIALIZING"]);

function shaOf(d: DeploymentListItem): string {
  const sha = d.meta?.githubCommitSha;
  return typeof sha === "string" ? sha.toLowerCase() : "";
}

/**
 * Cari deployment lama untuk `targetSha` lalu picu build ulang.
 * - sha belum pernah dibangun → `new-sha` (webhook push menanganinya);
 * - sha sedang dibangun → `in-progress` (biarkan selesai);
 * - sha sudah READY/ERROR/CANCELED → redeploy via API;
 * - env kurang → `skipped`; masalah API → `failed` (ref tetap berpindah).
 */
export async function ensureDeploymentForSha(
  opts: EnsureDeployOptions,
): Promise<VercelDeployResult> {
  const { token, projectId, teamId, targetSha } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!token || !projectId || !teamId) return { status: "skipped" };
  if (!/^[0-9a-f]{40}$/.test(targetSha)) {
    return { status: "failed", error: "SHA target tidak valid." };
  }

  const headers = { Authorization: `Bearer ${token}` };

  let items: DeploymentListItem[];
  try {
    const res = await fetchImpl(
      `${API}/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=50`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) {
      return {
        status: "failed",
        error: `Vercel merespons HTTP ${res.status} saat membaca daftar deployment.`,
      };
    }
    const data = (await res.json()) as { deployments?: DeploymentListItem[] };
    items = Array.isArray(data.deployments) ? data.deployments : [];
  } catch {
    return { status: "failed", error: "Tidak bisa terhubung ke Vercel." };
  }

  const matches = items.filter((d) => shaOf(d) === targetSha);
  // Daftar terbaru-dulu; utamakan deployment produksi bila sha itu juga
  // pernah dibangun di environment lain.
  const found =
    matches.find((d) => d.target === "production") ?? matches[0];
  if (!found || typeof found.uid !== "string") return { status: "new-sha" };

  const state = typeof found.readyState === "string" ? found.readyState : "";
  if (BUILDING_STATES.has(state)) {
    return { status: "in-progress", deploymentId: found.uid };
  }

  const projectName = typeof found.name === "string" ? found.name : "";
  if (!projectName) {
    return { status: "failed", error: "Nama project tidak ditemukan di Vercel." };
  }

  try {
    const res = await fetchImpl(
      `${API}/v13/deployments?teamId=${teamId}&forceNew=1`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          deploymentId: found.uid,
          target: "production",
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return {
        status: "failed",
        error: `Vercel menolak build ulang (HTTP ${res.status}).`,
      };
    }
    const data = (await res.json()) as { uid?: unknown };
    return {
      status: "redeployed",
      deploymentId: typeof data.uid === "string" ? data.uid : found.uid,
    };
  } catch {
    return { status: "failed", error: "Tidak bisa terhubung ke Vercel." };
  }
}

/** Catatan tambahan untuk pesan sukses aksi Update ("" bila tidak perlu). */
export function deployNoteText(result: VercelDeployResult): string {
  if (result.status === "failed") {
    return ` Peringatan: build ulang tidak terpicu (${result.error}).`;
  }
  if (result.status === "skipped") {
    return " Catatan: build ulang otomatis nonaktif (VERCEL_TOKEN belum diisi).";
  }
  return "";
}
