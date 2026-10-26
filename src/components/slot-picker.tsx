"use client";

import { useEffect, useState } from "react";

type StatusTanggal = "lewat" | "tutup" | "penuh" | "kosong";
type TanggalInfo = { date: string; status: StatusTanggal };
type SlotInfo = { jam: string; epoch: number; sisa: number; penuh: boolean };
type Respon = {
  now: number;
  jamBuka: string;
  jamTutup: string;
  hariAktif: string;
  kuotaParalel: number;
  config: { leadMinutes: number; horizonDays: number; bufferMinutes: number };
  tanggal: TanggalInfo[];
  slots: SlotInfo[] | null;
  statusDipilih: string | null;
};

const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const LABEL_STATUS: Record<StatusTanggal, string | null> = {
  lewat: null,
  tutup: "Tutup",
  penuh: "Penuh",
  kosong: null,
};

function labelTanggal(date: string): { hari: string; angka: string; bulan: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const bulan = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
  return { hari: HARI_PENDEK[dow], angka: String(d), bulan };
}

function labelPanjang(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function SlotPicker({
  branchId,
  value,
  onChange,
  pakaiLeadTime,
  name = "scheduledAt",
}: {
  branchId: string;
  /** "YYYY-MM-DDTHH:mm" atau "" */
  value: string;
  onChange: (v: string) => void;
  /** true untuk customer (lead time berlaku), false untuk staff. */
  pakaiLeadTime: boolean;
  name?: string;
}) {
  const [state, setState] = useState<{ key: string; data: Respon | null; err: string | null }>({
    key: "",
    data: null,
    err: null,
  });
  const [slotState, setSlotState] = useState<{
    key: string;
    slots: SlotInfo[] | null;
    err: string | null;
  }>({ key: "", slots: null, err: null });
  const [tanggalDipilih, setTanggalDipilih] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
    let batal = false;
    fetch(`/api/availability?branch=${encodeURIComponent(branchId)}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (batal) return;
        if (!ok || !body.ok) {
          setState({ key: branchId, data: null, err: body.error ?? "Gagal memuat ketersediaan." });
        } else {
          setState({ key: branchId, data: body as Respon, err: null });
        }
      })
      .catch(() => {
        if (!batal) setState({ key: branchId, data: null, err: "Gagal memuat ketersediaan." });
      });
    return () => {
      batal = true;
    };
  }, [branchId]);

  const data = state.key === branchId ? state.data : null;
  const errAmbil = state.key === branchId ? state.err : null;

  const tanggalAktif =
    tanggalDipilih ??
    (value ? value.slice(0, 10) : null) ??
    (data
      ? (data.tanggal.find((t) => t.status === "kosong")?.date ?? data.tanggal[0]?.date ?? null)
      : null);

  const kunciSlot = `${branchId}|${tanggalAktif ?? ""}`;
  useEffect(() => {
    if (!branchId || !tanggalAktif) return;
    let batal = false;
    fetch(
      `/api/availability?branch=${encodeURIComponent(branchId)}&date=${encodeURIComponent(tanggalAktif)}`,
    )
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (batal) return;
        if (!ok || !body.ok) {
          setSlotState({ key: kunciSlot, slots: null, err: body.error ?? "Gagal memuat slot." });
        } else {
          setSlotState({ key: kunciSlot, slots: (body.slots ?? []) as SlotInfo[], err: null });
        }
      })
      .catch(() => {
        if (!batal) setSlotState({ key: kunciSlot, slots: null, err: "Gagal memuat slot." });
      });
    return () => {
      batal = true;
    };
  }, [branchId, tanggalAktif, kunciSlot]);

  const slots = slotState.key === kunciSlot ? slotState.slots : null;
  const errSlot = slotState.key === kunciSlot ? slotState.err : null;

  if (!branchId) return null;

  const leadMenit = pakaiLeadTime && data ? data.config.leadMinutes : 0;
  const batasLead = data ? data.now + leadMenit * 60000 : Number.POSITIVE_INFINITY;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      {errAmbil && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{errAmbil}</p>
      )}
      {!data && !errAmbil && (
        <p className="text-sm text-muted-foreground">Memuat ketersediaan…</p>
      )}
      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            Buka {data.jamBuka.replace(":", ".")}–{data.jamTutup.replace(":", ".")} ·{" "}
            {data.hariAktif.split(",").length} hari/minggu · Kuota {data.kuotaParalel} pit paralel
          </p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {data.tanggal.map((t) => {
              const { hari, angka } = labelTanggal(t.date);
              const nonaktif = t.status === "tutup" || t.status === "penuh" || t.status === "lewat";
              const aktif = t.date === tanggalAktif;
              const label = LABEL_STATUS[t.status];
              return (
                <button
                  key={t.date}
                  type="button"
                  disabled={nonaktif}
                  onClick={() => {
                    setTanggalDipilih(t.date);
                    // Slot terpilih berasal dari tanggal lain — kosongkan
                    // supaya tidak ikut terkirim saat user ganti tanggal.
                    if (value && value.slice(0, 10) !== t.date) onChange("");
                  }}
                  title={labelPanjang(t.date)}
                  className={`w-14 shrink-0 rounded-lg border px-1 py-1.5 text-center active:opacity-90 ${
                    aktif
                      ? "border-primary bg-primary text-white"
                      : nonaktif
                        ? "border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-300 bg-surface text-foreground"
                  }`}
                >
                  <span className="block text-[10px] leading-tight">{hari}</span>
                  <span className="block text-base font-semibold leading-tight">{angka}</span>
                  <span className={`block text-[9px] leading-tight ${aktif ? "text-white/80" : ""}`}>
                    {label ?? " "}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <p className="mb-2 text-xs font-medium text-foreground">
              Jam kedatangan · {tanggalAktif ? labelPanjang(tanggalAktif) : "—"}
            </p>
            {errSlot && <p className="text-sm text-danger">{errSlot}</p>}
            {!slots && !errSlot && (
              <p className="text-sm text-muted-foreground">Memuat slot…</p>
            )}
            {slots && slots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {data.tanggal.find((t) => t.date === tanggalAktif)?.status === "tutup"
                  ? "Cabang tutup pada hari itu — pilih tanggal lain."
                  : "Tidak ada slot pada hari itu."}
              </p>
            )}
            {slots && slots.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((s) => {
                  const terlaluDini = s.epoch < batasLead;
                  const nonaktif = s.penuh || terlaluDini;
                  const jam = s.jam.replace(":", ".");
                  const nilai = `${tanggalAktif}T${s.jam}`;
                  const aktif = value === nilai;
                  return (
                    <button
                      key={s.jam}
                      type="button"
                      disabled={nonaktif}
                      title={
                        s.penuh
                          ? "Slot penuh"
                          : terlaluDini
                            ? `Minimal ${Math.ceil(leadMenit / 60)} jam lagi`
                            : `Sisa ${s.sisa} pit`
                      }
                      onClick={() => onChange(nilai)}
                      className={`rounded-lg border px-1 py-2 text-sm font-medium active:opacity-90 ${
                        aktif
                          ? "border-primary bg-primary text-white"
                          : nonaktif
                            ? "border-slate-200 bg-slate-100 text-slate-400"
                            : "border-slate-300 bg-surface text-foreground"
                      }`}
                    >
                      {jam}
                    </button>
                  );
                })}
              </div>
            )}
            {slots && slots.length > 0 && (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {leadMenit > 0
                  ? `Slot abu = penuh atau kurang dari ${Math.ceil(leadMenit / 60)} jam lagi. `
                  : ""}
                Jam dipilih = <span className="font-medium text-foreground">kedatangan</span> — unit
                dikerjakan segera setelah pit/mekanik tersedia, bukan janji jam selesai.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
