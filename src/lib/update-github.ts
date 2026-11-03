/**
 * Akses GitHub REST API untuk fitur Update (tarik / rollback channel).
 * Hanya dipanggil dari server (server action / RSC) — token tidak pernah
 * sampai ke client. Branch sumber rilis selalu `main`; branch channel
 * (release/…) adalah pointer yang dipindah oleh aksi Update.
 */

export const SOURCE_BRANCH = "main";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";

export class UpdateGitHubError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "UpdateGitHubError";
    this.status = status;
  }
}

function pesanGitHub(status: number): string {
  if (status === 401) return "Token GitHub tidak sah atau kedaluwarsa.";
  if (status === 403)
    return "Token GitHub ditolak (permission kurang atau kena rate limit).";
  if (status === 404) return "Repository atau branch tidak ditemukan di GitHub.";
  if (status === 409) return "Branch berubah saat diproses — coba lagi.";
  if (status === 422) return "GitHub menolak SHA target untuk branch ini.";
  return `GitHub merespons error (HTTP ${status}).`;
}

async function githubFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "revgo-speed-update",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new UpdateGitHubError("Tidak bisa terhubung ke GitHub.");
  }
  if (!res.ok) {
    throw new UpdateGitHubError(pesanGitHub(res.status), res.status);
  }
  return res;
}

export type CommitInfo = { sha: string; message: string; date: string };

/** Info commit terakhir sebuah branch (untuk tampilan "versi terbaru"). */
export async function fetchCommitInfo(
  repo: string,
  branch: string,
  token: string,
): Promise<CommitInfo> {
  const res = await githubFetch(
    `/repos/${repo}/commits/${branch}`,
    token,
  );
  const data = (await res.json()) as {
    sha?: unknown;
    commit?: { message?: unknown; committer?: { date?: unknown } };
  };
  const sha = typeof data.sha === "string" ? data.sha.toLowerCase() : "";
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new UpdateGitHubError("Respons GitHub tidak berisi SHA valid.");
  }
  const rawMessage = typeof data.commit?.message === "string" ? data.commit.message : "";
  const message = rawMessage.split("\n")[0].slice(0, 120);
  const date = typeof data.commit?.committer?.date === "string" ? data.commit.committer.date : "";
  return { sha, message, date };
}

/**
 * Pindahkan pointer branch channel ke SHA tertentu (dipaksa — rollback
 * bergerak mundur sehingga fast-forward saja tidak cukup).
 */
export async function updateBranchRef(
  repo: string,
  branch: string,
  sha: string,
  token: string,
): Promise<void> {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new UpdateGitHubError("SHA target tidak valid.");
  }
  await githubFetch(
    `/repos/${repo}/git/refs/heads/${branch}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ sha, force: true }),
    },
  );
}
