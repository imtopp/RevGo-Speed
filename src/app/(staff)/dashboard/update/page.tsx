import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { getAppName } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import {
  describeStatus,
  fullShaOrNull,
  isPendingFresh,
  parseHistory,
  parsePending,
  resolveChannel,
  rollbackTarget,
} from "@/lib/update-channel";
import {
  SOURCE_BRANCH,
  UpdateGitHubError,
  fetchCommitInfo,
} from "@/lib/update-github";
import { UpdateClient } from "./update-client";

export const metadata = { title: "Update" };

export default async function UpdatePage() {
  await requireOwnerOrSysAdmin();
  const appName = await getAppName();

  const token = process.env.GITHUB_TOKEN?.trim() ?? "";
  const env = resolveChannel({
    branch: process.env.UPDATE_CHANNEL_BRANCH,
    repo: process.env.GITHUB_REPO,
    token,
  });
  const configured = env.ok && env.hasToken;
  const currentSha = fullShaOrNull(process.env.VERCEL_GIT_COMMIT_SHA);

  const [histRow, pendRow] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: "update_history" },
      select: { value: true },
    }),
    prisma.systemSetting.findUnique({
      where: { key: "update_pending" },
      select: { value: true },
    }),
  ]);
  const history = parseHistory(histRow?.value ?? null);
  const pending = parsePending(pendRow?.value ?? null);
  const pendingFresh = isPendingFresh(pending, new Date().getTime());

  let latest: { sha: string; message: string; date: string } | null = null;
  let fetchError: string | null = null;
  if (env.ok && env.hasToken) {
    try {
      latest = await fetchCommitInfo(env.config.repo, SOURCE_BRANCH, token);
    } catch (e) {
      fetchError =
        e instanceof UpdateGitHubError
          ? e.message
          : "Gagal mengambil info versi terbaru dari GitHub.";
    }
  }

  const status = describeStatus({
    configured,
    currentSha,
    latestSha: latest?.sha ?? null,
    pendingFresh,
  });
  const rollbackTo = pendingFresh ? null : rollbackTarget(history);

  return (
    <UpdateClient
      appName={appName}
      channelBranch={env.ok ? env.config.branch : null}
      configured={configured}
      status={status}
      currentSha={currentSha}
      latestSha={latest?.sha ?? null}
      latestMessage={latest?.message ?? null}
      latestDate={latest?.date ?? null}
      fetchError={fetchError}
      history={history}
      rollbackTo={rollbackTo}
      pending={pending}
      pendingFresh={pendingFresh}
    />
  );
}
