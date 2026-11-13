"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@db/prisma/client";
import { auth } from "@/lib/auth";
import { assertActiveUser } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { resolveVersion } from "@/lib/version";
import {
  CONFIRM_PULL_WORD,
  CONFIRM_ROLLBACK_WORD,
  fullShaOrNull,
  isBuildActive,
  parseHistory,
  parsePending,
  pushHistory,
  resolveChannel,
  rollbackTarget,
  shortSha,
} from "@/lib/update-channel";
import {
  SOURCE_BRANCH,
  UpdateGitHubError,
  fetchCommitInfo,
  updateBranchRef,
} from "@/lib/update-github";
import {
  deployNoteText,
  ensureDeploymentForSha,
  type VercelDeployResult,
} from "@/lib/vercel-deploy";
import { revalidatePath } from "next/cache";

export type UpdateState = {
  error?: string;
  success?: string;
  pending?: { from: string; to: string; beforeVersion: string };
};

const KEY_HISTORY = "update_history";
const KEY_PENDING = "update_pending";

type Actor = Awaited<ReturnType<typeof requireUpdateActor>>;

async function requireUpdateActor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SYS_ADMIN") {
    throw new Error("Tidak punya akses.");
  }
  await assertActiveUser(session.user.id);
  return session;
}

function readUpdateEnv() {
  const token = process.env.GITHUB_TOKEN?.trim() ?? "";
  const env = resolveChannel({
    branch: process.env.UPDATE_CHANNEL_BRANCH,
    repo: process.env.GITHUB_REPO,
    token,
  });
  return { env, token };
}

function readVercelEnv() {
  return {
    token: process.env.VERCEL_TOKEN?.trim() ?? "",
    projectId: process.env.VERCEL_PROJECT_ID?.trim() ?? "",
    teamId: process.env.VERCEL_TEAM_ID?.trim() ?? "",
  };
}

/**
 * Setelah ref channel berpindah, pastikan SHA target benar-benar dibangun.
 * Vercel melewatkan webhook untuk sha yang sudah pernah dibangun (rollback
 * / tarik-ulang) — tanpa ini situs tetap di kode lama.
 */
async function triggerRebuild(targetSha: string): Promise<VercelDeployResult> {
  try {
    return await ensureDeploymentForSha({ ...readVercelEnv(), targetSha });
  } catch {
    return { status: "failed", error: "Gagal menghubungi Vercel." };
  }
}

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? null;
}

/**
 * Validasi umum sebelum aksi: guard role, env channel, backup, kata
 * konfirmasi, sha produksi, dan tidak ada build yang masih berjalan.
 */
async function guardUpdate(
  formData: FormData,
  confirmWord: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      session: Actor;
      repo: string;
      branch: string;
      token: string;
      currentSha: string;
    }
> {
  const session = await requireUpdateActor();

  const { env, token } = readUpdateEnv();
  if (!env.ok) {
    return {
      ok: false,
      error:
        env.reason === "branch"
          ? "Fitur update belum dikonfigurasi di server (UPDATE_CHANNEL_BRANCH tidak valid)."
          : "Fitur update belum dikonfigurasi di server (GITHUB_REPO tidak valid).",
    };
  }
  if (!token) {
    return {
      ok: false,
      error: "Token GitHub (GITHUB_TOKEN) belum dikonfigurasi di server.",
    };
  }

  if (String(formData.get("backupDone") ?? "") !== "1") {
    return { ok: false, error: "Centang dulu bahwa backup sudah diunduh & disimpan." };
  }
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== confirmWord) {
    return { ok: false, error: `Ketik ${confirmWord} untuk melanjutkan.` };
  }

  const currentSha = fullShaOrNull(process.env.VERCEL_GIT_COMMIT_SHA);
  if (!currentSha) {
    return {
      ok: false,
      error:
        "Fitur update hanya tersedia di deployment produksi (VERCEL_GIT_COMMIT_SHA tidak ada).",
    };
  }

  const pending = parsePending(await readSetting(KEY_PENDING));
  if (isBuildActive(pending, currentSha, new Date().getTime())) {
    return {
      ok: false,
      error: `Masih menunggu build ${shortSha(pending!.to)} — tunggu selesai (maks ±8 menit) sebelum aksi berikutnya.`,
    };
  }

  return {
    ok: true,
    session,
    repo: env.config.repo,
    branch: env.config.branch,
    token,
    currentSha,
  };
}

function actorLabel(session: Actor): string {
  return (session.user.name ?? session.user.email ?? "").trim() || "Owner";
}

function githubError(e: unknown): string {
  if (e instanceof UpdateGitHubError) return e.message;
  return "Gagal menghubungi GitHub — coba lagi.";
}

async function recordUpdate(
  session: Actor,
  branch: string,
  type: "pull" | "rollback",
  from: string,
  to: string,
): Promise<string> {
  const now = new Date().toISOString();
  const actor = actorLabel(session);
  const beforeVersion = resolveVersion(
    {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    },
    "local",
  );

  await prisma.$transaction(async (tx) => {
    const curHistory = parseHistory(await readSettingIn(tx, KEY_HISTORY));
    const history = pushHistory(curHistory, { type, from, to, at: now, actor });
    await upsertSettingIn(tx, KEY_HISTORY, JSON.stringify(history), session.user.id);
    await upsertSettingIn(
      tx,
      KEY_PENDING,
      JSON.stringify({ from, to, startedAt: now, actor, beforeVersion }),
      session.user.id,
    );
    await logAudit(tx, session.user, {
      action: type === "pull" ? "UPDATE_PULL" : "UPDATE_ROLLBACK",
      entityType: "UpdateChannel",
      entityId: branch,
      summary:
        type === "pull"
          ? `Channel ${branch}: ${shortSha(from)} → ${shortSha(to)} (tarik ${SOURCE_BRANCH})`
          : `Channel ${branch}: ${shortSha(from)} → ${shortSha(to)} (rollback)`,
      before: { sha: from },
      after: { sha: to },
    });
  });

  return beforeVersion;
}

export async function doUpdate(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const mode = String(formData.get("mode") ?? "");
  if (mode !== "pull" && mode !== "rollback") {
    return { error: "Aksi tidak dikenal." };
  }

  const g = await guardUpdate(
    formData,
    mode === "pull" ? CONFIRM_PULL_WORD : CONFIRM_ROLLBACK_WORD,
  );
  if (!g.ok) return { error: g.error };
  const { session, repo, branch, token, currentSha } = g;

  if (mode === "pull") {
    let latest;
    try {
      latest = await fetchCommitInfo(repo, SOURCE_BRANCH, token);
    } catch (e) {
      return { error: githubError(e) };
    }
    if (latest.sha === currentSha) {
      return { success: `Sudah di versi terbaru (${shortSha(currentSha)}).` };
    }
    try {
      await updateBranchRef(repo, branch, latest.sha, token);
    } catch (e) {
      return { error: githubError(e) };
    }
    const deploy = await triggerRebuild(latest.sha);
    revalidatePath("/dashboard/update");
    return {
      success: `Ref channel dipindah ke ${shortSha(latest.sha)}. Build sedang berjalan…${deployNoteText(deploy)}`,
      pending: {
        from: currentSha,
        to: latest.sha,
        beforeVersion: await recordUpdate(session, branch, "pull", currentSha, latest.sha),
      },
    };
  }

  const history = parseHistory(await readSetting(KEY_HISTORY));
  const target = rollbackTarget(history);
  if (!target) {
    return { error: "Belum ada riwayat update untuk dikembalikan." };
  }
  if (target === currentSha) {
    return { success: `Sudah berada di versi ${shortSha(target)}.` };
  }
  try {
    await updateBranchRef(repo, branch, target, token);
  } catch (e) {
    return { error: githubError(e) };
  }
  const deploy = await triggerRebuild(target);
  revalidatePath("/dashboard/update");
  return {
    success: `Ref channel dikembalikan ke ${shortSha(target)}. Build sedang berjalan…${deployNoteText(deploy)}`,
    pending: {
      from: currentSha,
      to: target,
      beforeVersion: await recordUpdate(session, branch, "rollback", currentSha, target),
    },
  };
}

type Tx = Prisma.TransactionClient;

async function readSettingIn(tx: Tx, key: string): Promise<string | null> {
  const row = await tx.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? null;
}

async function upsertSettingIn(tx: Tx, key: string, value: string, userId: string) {
  await tx.systemSetting.upsert({
    where: { key },
    update: { value, updatedBy: userId },
    create: { key, value, updatedBy: userId },
  });
}
