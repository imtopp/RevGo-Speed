import { describe, it, expect } from "vitest";
import {
  resolveChannel,
  isFullSha,
  fullShaOrNull,
  shortSha,
  parseHistory,
  pushHistory,
  parsePending,
  isPendingFresh,
  describeStatus,
  rollbackTarget,
  HISTORY_LIMIT,
  PENDING_TTL_MS,
  type HistoryEntry,
} from "./update-channel";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

describe("resolveChannel", () => {
  it("valid bila branch & repo format benar", () => {
    const r = resolveChannel({
      branch: "release/tbrt",
      repo: "imtopp/RevGo-Speed",
      token: "ghp_x",
    });
    expect(r).toEqual({
      ok: true,
      config: { branch: "release/tbrt", repo: "imtopp/RevGo-Speed" },
      hasToken: true,
    });
  });

  it("trim spasi & laporkan token kosong", () => {
    const r = resolveChannel({ branch: "  main  ", repo: " a/b ", token: "  " });
    expect(r).toEqual({
      ok: true,
      config: { branch: "main", repo: "a/b" },
      hasToken: false,
    });
  });

  it("tolak branch kosong / karakter aneh / traversal", () => {
    for (const branch of ["", "   ", "a b", "a..b", "/x", "x/", "a//b", "x;rm"]) {
      expect(resolveChannel({ branch, repo: "a/b" })).toEqual({
        ok: false,
        reason: "branch",
      });
    }
  });

  it("tolak repo yang bukan owner/name", () => {
    for (const repo of ["", "noslash", "a/b/c", "a b/c", "A/B*"]) {
      expect(resolveChannel({ branch: "main", repo })).toEqual({
        ok: false,
        reason: "repo",
      });
    }
  });
});

describe("sha helpers", () => {
  it("isFullSha hanya 40 hex", () => {
    expect(isFullSha(SHA_A)).toBe(true);
    expect(isFullSha("abc")).toBe(false);
    expect(isFullSha(null)).toBe(false);
    expect(isFullSha(SHA_A + "0")).toBe(false);
    expect(isFullSha("z".repeat(40))).toBe(false);
  });

  it("fullShaOrNull trim & lowercase, invalid → null", () => {
    expect(fullShaOrNull(`  ${SHA_A.toUpperCase()}  `)).toBe(SHA_A);
    expect(fullShaOrNull("deadbeef")).toBe(null);
    expect(fullShaOrNull(undefined)).toBe(null);
  });

  it("shortSha 7 karakter", () => {
    expect(shortSha(SHA_A)).toBe("aaaaaaa");
  });
});

describe("parseHistory / pushHistory", () => {
  it("parse riwayat valid", () => {
    const raw = JSON.stringify([
      { type: "pull", from: SHA_A, to: SHA_B, at: "2026-11-03", actor: "Andi" },
    ]);
    const h = parseHistory(raw);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ type: "pull", from: SHA_A, to: SHA_B });
  });

  it("input rusak → []", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("bukan json {")).toEqual([]);
    expect(parseHistory('"bukan array"')).toEqual([]);
    expect(parseHistory("[1,2]")).toEqual([]);
    expect(
      parseHistory(JSON.stringify([{ type: "hapus", to: SHA_A }])),
    ).toEqual([]);
    expect(
      parseHistory(JSON.stringify([{ type: "pull", to: "pendek" }])),
    ).toEqual([]);
  });

  it("from tidak valid → null (tetap tampil)", () => {
    const h = parseHistory(
      JSON.stringify([{ type: "pull", from: "xx", to: SHA_A }]),
    );
    expect(h[0].from).toBe(null);
  });

  it("pushHistory terbaru di depan & dibatasi HISTORY_LIMIT", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      list = pushHistory(list, {
        type: "pull",
        from: null,
        to: SHA_A,
        at: String(i),
        actor: "x",
      });
    }
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].at).toBe(String(HISTORY_LIMIT + 4));
  });
});

describe("parsePending / isPendingFresh", () => {
  it("parse pending valid", () => {
    const raw = JSON.stringify({
      from: SHA_A,
      to: SHA_B,
      startedAt: "2026-11-03T00:00:00.000Z",
      actor: "Budi",
      beforeVersion: "dpl_1",
    });
    expect(parsePending(raw)).toMatchObject({ from: SHA_A, to: SHA_B });
  });

  it("rusak / sha tidak valid → null", () => {
    expect(parsePending("x")).toBe(null);
    expect(parsePending(null)).toBe(null);
    expect(
      parsePending(JSON.stringify({ from: SHA_A, to: "pendek", startedAt: "x" })),
    ).toBe(null);
    expect(
      parsePending(JSON.stringify({ from: SHA_A, to: SHA_B })),
    ).toBe(null);
  });

  it("fresh dalam TTL, kedaluwarsa setelahnya, waktu mundur tak infinite", () => {
    const pending = parsePending(
      JSON.stringify({
        from: SHA_A,
        to: SHA_B,
        startedAt: "2026-11-03T00:00:00.000Z",
        beforeVersion: "dpl_1",
      }),
    )!;
    const t0 = Date.parse("2026-11-03T00:00:00.000Z");
    expect(isPendingFresh(pending, t0)).toBe(true);
    expect(isPendingFresh(pending, t0 + PENDING_TTL_MS)).toBe(true);
    expect(isPendingFresh(pending, t0 + PENDING_TTL_MS + 1)).toBe(false);
    expect(isPendingFresh(pending, t0 - 1_000)).toBe(false);
    expect(isPendingFresh(null, t0)).toBe(false);
    expect(
      isPendingFresh({ ...pending, startedAt: "acak" }, t0),
    ).toBe(false);
  });
});

describe("describeStatus", () => {
  const base = { configured: true, currentSha: SHA_A, latestSha: SHA_B, pendingFresh: false };

  it("belum dikonfigurasi menang duluan", () => {
    expect(describeStatus({ ...base, configured: false, pendingFresh: true })).toBe(
      "NOT_CONFIGURED",
    );
  });

  it("build berjalan menang atas perbandingan sha", () => {
    expect(describeStatus({ ...base, pendingFresh: true })).toBe("BUILDING");
  });

  it("tanpa sha terdeploy (lokal) → LOCAL", () => {
    expect(describeStatus({ ...base, currentSha: null })).toBe("LOCAL");
  });

  it("sha terbaru tidak terbaca → UNKNOWN", () => {
    expect(describeStatus({ ...base, latestSha: null })).toBe("UNKNOWN");
  });

  it("sama → UP_TO_DATE, beda → UPDATE_AVAILABLE", () => {
    expect(describeStatus({ ...base, latestSha: SHA_A })).toBe("UP_TO_DATE");
    expect(describeStatus(base)).toBe("UPDATE_AVAILABLE");
  });
});

describe("rollbackTarget", () => {
  it("riwayat kosong → null", () => {
    expect(rollbackTarget([])).toBe(null);
  });

  it("entry terakhir tanpa from → null", () => {
    expect(
      rollbackTarget([{ type: "pull", from: null, to: SHA_B, at: "", actor: "" }]),
    ).toBe(null);
  });

  it("target = from entry terbaru", () => {
    expect(
      rollbackTarget([
        { type: "pull", from: SHA_A, to: SHA_B, at: "", actor: "" },
        { type: "pull", from: null, to: SHA_A, at: "", actor: "" },
      ]),
    ).toBe(SHA_A);
  });
});
