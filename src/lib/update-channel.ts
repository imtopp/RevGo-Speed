export type ChannelConfig = { branch: string; repo: string };

export type ChannelEnv = {
  branch?: string | null;
  repo?: string | null;
  token?: string | null;
};

export type ChannelResolution =
  | { ok: true; config: ChannelConfig; hasToken: boolean }
  | { ok: false; reason: "branch" | "repo" };

const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;
const REPO_RE = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

/**
 * Normalisasi & validasi env channel update (UPDATE_CHANNEL_BRANCH,
 * GITHUB_REPO, GITHUB_TOKEN). Branch dipakai sebagai path Git yang
 * dipindah paksa — wajib terkontrol, bukan input bebas.
 */
export function resolveChannel(env: ChannelEnv): ChannelResolution {
  const branch = env.branch?.trim() ?? "";
  const repo = env.repo?.trim() ?? "";
  if (
    !branch ||
    !BRANCH_RE.test(branch) ||
    branch.includes("..") ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.includes("//")
  ) {
    return { ok: false, reason: "branch" };
  }
  if (!repo || !REPO_RE.test(repo)) {
    return { ok: false, reason: "repo" };
  }
  return {
    ok: true,
    config: { branch, repo },
    hasToken: Boolean(env.token?.trim()),
  };
}

export const FULL_SHA_RE = /^[0-9a-f]{40}$/;

export function isFullSha(value: string | null | undefined): boolean {
  return typeof value === "string" && FULL_SHA_RE.test(value);
}

export function fullShaOrNull(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase() ?? "";
  return isFullSha(v) ? v : null;
}

/** SHA pendek 7 karakter untuk ditampilkan (aman — repo publik, SHA bukan rahasia). */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export type HistoryEntry = {
  type: "pull" | "rollback";
  from: string | null;
  to: string;
  at: string;
  actor: string;
};

export const HISTORY_LIMIT = 20;

export function parseHistory(raw: string | null | undefined): HistoryEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: HistoryEntry[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const type = e.type;
    const to = typeof e.to === "string" ? fullShaOrNull(e.to) : null;
    if ((type !== "pull" && type !== "rollback") || !to) continue;
    const from =
      typeof e.from === "string" && e.from ? fullShaOrNull(e.from) : null;
    out.push({
      type,
      from,
      to,
      at: typeof e.at === "string" ? e.at : "",
      actor: typeof e.actor === "string" ? e.actor : "",
    });
  }
  return out.slice(0, HISTORY_LIMIT);
}

export function pushHistory(
  list: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [entry, ...list].slice(0, HISTORY_LIMIT);
}

export type PendingUpdate = {
  from: string;
  to: string;
  startedAt: string;
  actor: string;
  beforeVersion: string;
};

export function parsePending(
  raw: string | null | undefined,
): PendingUpdate | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const e = data as Record<string, unknown>;
  const from = typeof e.from === "string" ? fullShaOrNull(e.from) : null;
  const to = typeof e.to === "string" ? fullShaOrNull(e.to) : null;
  if (!from || !to || typeof e.startedAt !== "string") return null;
  return {
    from,
    to,
    startedAt: e.startedAt,
    actor: typeof e.actor === "string" ? e.actor : "",
    beforeVersion: typeof e.beforeVersion === "string" ? e.beforeVersion : "",
  };
}

/** Build Vercel biasanya ≤3 menit; lewat batas ini dianggap gagal. */
export const PENDING_TTL_MS = 8 * 60_000;

export function isPendingFresh(
  pending: PendingUpdate | null,
  nowMs: number,
): boolean {
  if (!pending) return false;
  const started = Date.parse(pending.startedAt);
  if (Number.isNaN(started)) return false;
  const age = nowMs - started;
  return age >= 0 && age <= PENDING_TTL_MS;
}

/**
 * Build masih dianggap berjalan hanya selama pending fresh DAN SHA yang
 * sedang berjalan belum sama dengan tujuan. Begitu versi target sudah
 * aktif (currentSha === pending.to), pending tidak boleh dipakai lagi —
 * kalau tidak, status tetap BUILDING dan halaman update reload terus
 * sampai TTL habis (loop "Update aktif — memuat ulang" berulang-ulang).
 * currentSha null (belum terbaca) dianggap build masih berjalan.
 */
export function isBuildActive(
  pending: PendingUpdate | null,
  currentSha: string | null,
  nowMs: number,
): boolean {
  if (!pending || !isPendingFresh(pending, nowMs)) return false;
  if (!currentSha) return true;
  return currentSha !== pending.to;
}

export type ChannelStatus =
  | "NOT_CONFIGURED"
  | "LOCAL"
  | "BUILDING"
  | "UP_TO_DATE"
  | "UPDATE_AVAILABLE"
  | "UNKNOWN";

export function describeStatus(input: {
  configured: boolean;
  currentSha: string | null;
  latestSha: string | null;
  buildActive: boolean;
}): ChannelStatus {
  if (!input.configured) return "NOT_CONFIGURED";
  if (input.buildActive) return "BUILDING";
  if (!input.currentSha) return "LOCAL";
  if (!input.latestSha) return "UNKNOWN";
  return input.currentSha === input.latestSha ? "UP_TO_DATE" : "UPDATE_AVAILABLE";
}

/** SHA tujuan rollback = pin sebelum perubahan terakhir di riwayat. */
export function rollbackTarget(history: HistoryEntry[]): string | null {
  const last = history[0];
  if (!last?.from || !isFullSha(last.from)) return null;
  return last.from;
}

/** Kata konfirmasi ketik-manual — divalidasi server & client. */
export const CONFIRM_PULL_WORD = "PERBARUI";
export const CONFIRM_ROLLBACK_WORD = "KEMBALIKAN";
