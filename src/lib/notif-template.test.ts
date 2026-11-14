import { describe, expect, it } from "vitest";
import {
  defaultTemplate,
  kumpulkanTemplateDariForm,
  renderTemplate,
  sanitasiTemplateOverrides,
  TEMPLATE_DEFS,
  TPL_BODY_MAX,
  TPL_TITLE_MAX,
} from "./notif-template";

describe("TEMPLATE_DEFS", () => {
  it("id unik dan hanya grup Push/WhatsApp", () => {
    const ids = TEMPLATE_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TEMPLATE_DEFS.every((d) => d.grup === "Push" || d.grup === "WhatsApp")).toBe(true);
  });

  it("setiap {token} di default terdaftar di variabel field-nya", () => {
    for (const def of TEMPLATE_DEFS) {
      for (const f of def.fields) {
        const tokens = [...f.default.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
        for (const t of tokens) {
          expect(f.variabel, `${def.id}.${f.name} → {${t}}`).toContain(t);
        }
      }
    }
  });

  it("default push cocok persis dengan teks notifikasi yang beredar", () => {
    expect(defaultTemplate("push.booking_baru", "title")).toBe("Booking baru masuk");
    expect(defaultTemplate("push.booking_baru", "body")).toBe(
      "{code} · {plate} · {jadwal}",
    );
    expect(defaultTemplate("push.estimasi", "body")).toBe(
      "{code} · estimasi {estimasi} — buka Pesanan untuk menyetujui",
    );
    expect(defaultTemplate("push.jadwal", "body")).toBe("{code} → {jadwal}");
    expect(defaultTemplate("push.batal", "body")).toBe("{code}{alasan}");
    expect(defaultTemplate("push.selesai", "body")).toBe(
      "{code} — motor siap diambil",
    );
    expect(defaultTemplate("push.stok", "body")).toBe(
      "{nama} tersisa {qty} {unit} (min {min_stok})",
    );
  });

  it("defaultTemplate id/field tak dikenal = string kosong", () => {
    expect(defaultTemplate("push.tidak_ada", "title")).toBe("");
    expect(defaultTemplate("wa.pembatalan", "title")).toBe("");
  });
});

describe("renderTemplate", () => {
  it("mengganti semua token yang punya nilai", () => {
    expect(renderTemplate("{code} · {plate}", { code: "SV-1", plate: "B 1" })).toBe(
      "SV-1 · B 1",
    );
  });

  it("token tanpa pasangan dibiarkan apa adanya (salah ketik kelihatan)", () => {
    expect(renderTemplate("{code} {typo}", { code: "SV-1" })).toBe("SV-1 {typo}");
  });

  it("menerima angka dan string kosong", () => {
    expect(renderTemplate("{qty} {unit}", { qty: 3, unit: "" })).toBe("3 ");
  });
});

describe("sanitasiTemplateOverrides", () => {
  const valid = JSON.stringify({
    "push.batal": { title: "Dibatalkan", body: "{code} dibatalkan" },
  });

  it("menerima JSON valid dan menghapus nilai = default", () => {
    const out = sanitasiTemplateOverrides(valid);
    expect(out["push.batal"]).toEqual({
      title: "Dibatalkan",
      body: "{code} dibatalkan",
    });
    const samaDefault = JSON.stringify({
      "push.batal": { title: "Booking dibatalkan" },
    });
    expect(sanitasiTemplateOverrides(samaDefault)).toEqual({});
  });

  it("JSON rusak / bukan objek → {}", () => {
    expect(sanitasiTemplateOverrides("bukan json")).toEqual({});
    expect(sanitasiTemplateOverrides("[1,2]")).toEqual({});
    expect(sanitasiTemplateOverrides("null")).toEqual({});
  });

  it("membuang entri tak dikenal, tipe salah, kosong, dan melebihi batas", () => {
    const raw = JSON.stringify({
      "push.tidak_ada": { title: "x" },
      "push.batal": {
        title: "ok",
        body: 123,
        extra: "abaikan",
        // melebihi batas → dibuang
        // (diuji terpisah di bawah)
      },
      "wa.pembatalan": { body: "   " },
    });
    const out = sanitasiTemplateOverrides(raw);
    expect(out).toEqual({ "push.batal": { title: "ok" } });

    const kepanjangan = JSON.stringify({
      "push.batal": { title: "x".repeat(TPL_TITLE_MAX + 1) },
    });
    expect(sanitasiTemplateOverrides(kepanjangan)).toEqual({});

    const bodyKepanjangan = JSON.stringify({
      "wa.pembatalan": { body: "x".repeat(TPL_BODY_MAX + 1) },
    });
    expect(sanitasiTemplateOverrides(bodyKepanjangan)).toEqual({});
  });
});

describe("kumpulkanTemplateDariForm", () => {
  it("nilai = default atau kosong tidak jadi override", () => {
    const fd = new FormData();
    fd.set("tpl.push.batal.title", "Booking dibatalkan");
    fd.set("tpl.push.batal.body", "");
    const { overrides, error } = kumpulkanTemplateDariForm(fd);
    expect(error).toBeUndefined();
    expect(overrides).toEqual({});
  });

  it("nilai berbeda dari default jadi override", () => {
    const fd = new FormData();
    fd.set("tpl.push.batal.title", "Dibatalkan");
    fd.set("tpl.wa.pembatalan.body", "Maaf, booking {code} batal.");
    const { overrides } = kumpulkanTemplateDariForm(fd);
    expect(overrides).toEqual({
      "push.batal": { title: "Dibatalkan" },
      "wa.pembatalan": { body: "Maaf, booking {code} batal." },
    });
  });

  it("melebihi batas → error berbahasa Indonesia", () => {
    const fd = new FormData();
    fd.set("tpl.push.batal.title", "x".repeat(TPL_TITLE_MAX + 1));
    const { error } = kumpulkanTemplateDariForm(fd);
    expect(error).toContain("maksimal");
    expect(error).toContain(String(TPL_TITLE_MAX));
  });
});
