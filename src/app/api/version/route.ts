import { NextResponse } from "next/server";
import { resolveVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

// Stabil selama proses server hidup (globalThis: tahan re-evaluasi module
// saat dev HMR); berubah hanya saat dev server/proses baru.
const g = globalThis as typeof globalThis & { __revgoStartedAt?: number };
if (!g.__revgoStartedAt) g.__revgoStartedAt = Date.now();

export function GET() {
  const version = resolveVersion(
    {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    },
    `local-${g.__revgoStartedAt}`,
  );
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
