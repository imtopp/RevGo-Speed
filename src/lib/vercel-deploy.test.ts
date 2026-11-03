import { describe, it, expect, vi } from "vitest";
import {
  ensureDeploymentForSha,
  deployNoteText,
  type EnsureDeployOptions,
} from "./vercel-deploy";

const SHA = "a".repeat(40);
const SHA_B = "b".repeat(40);

const BASE: Omit<EnsureDeployOptions, "fetchImpl"> = {
  token: "vrc_test",
  projectId: "prj_x",
  teamId: "team_x",
  targetSha: SHA,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deployment(over: Record<string, unknown> = {}) {
  return {
    uid: "dpl_old",
    name: "proj",
    readyState: "READY",
    target: "production",
    meta: { githubCommitSha: SHA },
    ...over,
  };
}

function mockFetch(
  impl: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return impl(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("ensureDeploymentForSha", () => {
  it("skipped bila token/project/team belum dikonfigurasi", async () => {
    for (const partial of [
      { token: "" },
      { projectId: "" },
      { teamId: "" },
    ] as Partial<EnsureDeployOptions>[]) {
      const r = await ensureDeploymentForSha({
        ...BASE,
        ...partial,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      });
      expect(r).toEqual({ status: "skipped" });
    }
  });

  it("failed bila SHA target bukan 40-hex", async () => {
    const r = await ensureDeploymentForSha({
      ...BASE,
      targetSha: "bukan-sha",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(r.status).toBe("failed");
  });

  it("new-sha bila belum ada deployment untuk target (biarkan webhook)", async () => {
    const { fetchImpl, calls } = mockFetch(() =>
      jsonResponse({ deployments: [deployment({ meta: { githubCommitSha: SHA_B } })] }),
    );
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({ status: "new-sha" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/v6/deployments");
    expect(calls[0].init?.method).toBeUndefined();
  });

  it("redeploy: POST build ulang memakai deployment lama utk sha target", async () => {
    const { fetchImpl, calls } = mockFetch((url) =>
      url.includes("/v6/deployments")
        ? jsonResponse({ deployments: [deployment()] })
        : jsonResponse({ uid: "dpl_new" }),
    );
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({ status: "redeployed", deploymentId: "dpl_new" });
    expect(calls).toHaveLength(2);
    const post = calls[1];
    expect(post.url).toContain("/v13/deployments");
    expect(post.url).toContain("forceNew=1");
    expect(post.init?.method).toBe("POST");
    expect(JSON.parse(String(post.init?.body))).toEqual({
      name: "proj",
      deploymentId: "dpl_old",
      target: "production",
    });
  });

  it("in-progress bila sha target sedang dibangun (tanpa POST)", async () => {
    const { fetchImpl, calls } = mockFetch(() =>
      jsonResponse({ deployments: [deployment({ readyState: "BUILDING" })] }),
    );
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({ status: "in-progress", deploymentId: "dpl_old" });
    expect(calls).toHaveLength(1);
  });

  it("utamakan deployment produksi saat sha juga pernah dibangun di preview", async () => {
    const preview = deployment({
      uid: "dpl_prev",
      target: "preview",
    });
    const prod = deployment({ uid: "dpl_prod" });
    const { fetchImpl, calls } = mockFetch((url) =>
      url.includes("/v6/deployments")
        ? jsonResponse({ deployments: [preview, prod] })
        : jsonResponse({ uid: "dpl_new2" }),
    );
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({ status: "redeployed", deploymentId: "dpl_new2" });
    expect(JSON.parse(String(calls[1].init?.body)).deploymentId).toBe("dpl_prod");
  });

  it("failed bila daftar deployment gagal diambil", async () => {
    const { fetchImpl } = mockFetch(() => jsonResponse({}, 500));
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({
      status: "failed",
      error: "Vercel merespons HTTP 500 saat membaca daftar deployment.",
    });
  });

  it("failed bila koneksi list melempar error", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({ status: "failed", error: "Tidak bisa terhubung ke Vercel." });
  });

  it("failed bila POST redeploy ditolak", async () => {
    const { fetchImpl } = mockFetch((url) =>
      url.includes("/v6/deployments")
        ? jsonResponse({ deployments: [deployment()] })
        : jsonResponse({ error: "nope" }, 403),
    );
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({
      status: "failed",
      error: "Vercel menolak build ulang (HTTP 403).",
    });
  });

  it("redeployed memakai uid lama bila respons POST tanpa uid", async () => {
    const { fetchImpl } = mockFetch((url) =>
      url.includes("/v6/deployments")
        ? jsonResponse({ deployments: [deployment()] })
        : jsonResponse({}),
    );
    const r = await ensureDeploymentForSha({ ...BASE, fetchImpl });
    expect(r).toEqual({ status: "redeployed", deploymentId: "dpl_old" });
  });
});

describe("deployNoteText", () => {
  it("peringatan saat gagal, catatan saat skipped, kosong saat jalan", () => {
    expect(deployNoteText({ status: "failed", error: "x" })).toContain("Peringatan");
    expect(deployNoteText({ status: "skipped" })).toContain("VERCEL_TOKEN");
    expect(deployNoteText({ status: "redeployed", deploymentId: "d" })).toBe("");
    expect(deployNoteText({ status: "in-progress", deploymentId: "d" })).toBe("");
    expect(deployNoteText({ status: "new-sha" })).toBe("");
  });
});
