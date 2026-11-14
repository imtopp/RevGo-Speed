import { describe, expect, it } from "vitest";
import {
  buatTokenJemput,
  chatIdsUntuk,
  hubungkanChat,
  parseStartToken,
  putuskanChat,
  sanitasiTelegramConfig,
  teksPesanTelegram,
  urlJemput,
  type TelegramConfig,
} from "./telegram";

const cfg = (partial: Partial<TelegramConfig>): TelegramConfig => ({
  chats: {},
  tokens: {},
  ...partial,
});

describe("sanitasiTelegramConfig", () => {
  it("JSON rusak / bukan objek → config kosong", () => {
    expect(sanitasiTelegramConfig("bukan json")).toEqual({
      chats: {},
      tokens: {},
    });
    expect(sanitasiTelegramConfig("[1]")).toEqual({ chats: {}, tokens: {} });
    expect(sanitasiTelegramConfig("null")).toEqual({ chats: {}, tokens: {} });
  });

  it("mempertahankan field valid & membuang yang aneh", () => {
    const out = sanitasiTelegramConfig(
      JSON.stringify({
        botUsername: " my_bot ",
        webhookSecret: "s3cret",
        chats: { u1: "12345", u2: "bukan-chat" },
        tokens: { abcdef12: "u1", "tok!en": "u2", ab: "u3" },
        extra: "abaikan",
      }),
    );
    expect(out.botUsername).toBe("my_bot");
    expect(out.webhookSecret).toBe("s3cret");
    expect(out.chats).toEqual({ u1: "12345" });
    expect(out.tokens).toEqual({ abcdef12: "u1" });
    expect((out as Record<string, unknown>).extra).toBeUndefined();
  });

  it("chatId negatif (grup) diterima", () => {
    const out = sanitasiTelegramConfig(
      JSON.stringify({ chats: { u1: "-100123456" } }),
    );
    expect(out.chats.u1).toBe("-100123456");
  });
});

describe("buatTokenJemput & urlJemput", () => {
  it("token hex unik & cocok pola deep link", () => {
    const a = buatTokenJemput();
    const b = buatTokenJemput();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toBe(b);
  });

  it("urlJemput = deep link t.me dengan param start", () => {
    expect(urlJemput("my_bot", "abc123")).toBe(
      "https://t.me/my_bot?start=abc123",
    );
  });
});

describe("parseStartToken", () => {
  it("mengambil token dari perintah /start", () => {
    expect(parseStartToken("/start abcdef12")).toBe("abcdef12");
    expect(parseStartToken("  /start abcdef12  ")).toBe("abcdef12");
  });

  it("menolak bukan /start, token pendek, atau bukan string", () => {
    expect(parseStartToken("/help abcdef12")).toBeNull();
    expect(parseStartToken("/start")).toBeNull();
    expect(parseStartToken("/start ab")).toBeNull();
    expect(parseStartToken("/start abc!def")).toBeNull();
    expect(parseStartToken(undefined)).toBeNull();
    expect(parseStartToken(123)).toBeNull();
  });
});

describe("hubungkanChat", () => {
  const base = cfg({ tokens: { jemput123: "user-1" } });

  it("token valid → chat terikat & token terbuang (sekali pakai)", () => {
    const hasil = hubungkanChat(base, "jemput123", "54321");
    expect(hasil).not.toBeNull();
    expect(hasil!.userId).toBe("user-1");
    expect(hasil!.config.chats["user-1"]).toBe("54321");
    expect(hasil!.config.tokens.jemput123).toBeUndefined();
    // pemakaian kedua gagal:
    expect(hubungkanChat(hasil!.config, "jemput123", "999")).toBeNull();
  });

  it("token tak dikenal / chatId aneh → null, config tak berubah", () => {
    expect(hubungkanChat(base, "tidak-ada", "54321")).toBeNull();
    expect(hubungkanChat(base, "jemput123", "bukan-angka")).toBeNull();
    expect(hubungkanChat(base, "jemput123", "54321")!.config).not.toBe(base);
  });
});

describe("putuskanChat & chatIdsUntuk", () => {
  it("putus menghapus chat user itu saja", () => {
    const c = cfg({ chats: { u1: "111", u2: "222" } });
    const out = putuskanChat(c, "u1");
    expect(out.chats).toEqual({ u2: "222" });
  });

  it("chatIds hanya user terhubung, unik, urut input", () => {
    const c = cfg({ chats: { u1: "111", u2: "222" } });
    expect(chatIdsUntuk(c, ["u1", "u3", "u2", "u1"])).toEqual(["111", "222"]);
    expect(chatIdsUntuk(c, [])).toEqual([]);
    expect(chatIdsUntuk(cfg({}), ["u1"])).toEqual([]);
  });
});

describe("teksPesanTelegram", () => {
  it("judul + isi, atau hanya judul bila isi kosong", () => {
    expect(teksPesanTelegram("Booking baru", "SV-1 · B 1 XY")).toBe(
      "Booking baru\nSV-1 · B 1 XY",
    );
    expect(teksPesanTelegram("Booking baru", "  ")).toBe("Booking baru");
  });
});
