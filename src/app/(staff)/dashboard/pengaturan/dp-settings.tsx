"use client";

import { useActionState, useState } from "react";
import { updateDpSettings, type SettingState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const labelCls = "block text-sm font-medium text-foreground";
const checkCls = "h-4 w-4 rounded border-slate-300";
const panelCls =
  "ml-6 space-y-3 rounded-lg bg-background p-3 ring-1 ring-slate-200";
const fileCls =
  "block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground";

/**
 * Satu form untuk seluruh bagian DP Booking — satu tombol Simpan.
 * Urutan: batas no-show & kebijakan refund (di atas), nominal, sakelar
 * transfer (centang → muncul detail rekening), sakelar QRIS (centang →
 * muncul input gambar tepat di bawahnya; file ikut tersimpan saat Simpan).
 */
export function DpSettings({ initial }: { initial: Record<string, string> }) {
  const [state, action] = useActionState<SettingState, FormData>(
    updateDpSettings,
    {},
  );
  const [transfer, setTransfer] = useState(
    initial.dp_transfer_enabled === "true",
  );
  const [qris, setQris] = useState(initial.dp_qris_enabled === "true");
  const gambarQris = initial.dp_qris_image ?? "";

  return (
    <form
      onReset={(e) => e.preventDefault()}
      action={action}
      className="space-y-3"
    >
      <div>
        <label className={labelCls} htmlFor="dp_no_show_days">
          Batas No-Show (hari)
        </label>
        <input
          id="dp_no_show_days"
          name="dp_no_show_days"
          inputMode="numeric"
          defaultValue={initial.dp_no_show_days ?? "7"}
          placeholder="7 — lewat ini DP hangus & boleh dibatalkan"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="dp_policy">
          Kebijakan Refund DP
        </label>
        <select
          id="dp_policy"
          name="dp_policy"
          defaultValue={initial.dp_policy || "TANPA_REFUND"}
          className={inputCls}
        >
          <option value="TANPA_REFUND">
            Tanpa refund — DP tetap ditahan bengkel saat batal / no-show
          </option>
          <option value="REFUND_PENUH">
            Refund penuh — DP dikembalikan (wajib void lewat menu Kas)
          </option>
        </select>
      </div>

      <div>
        <label className={labelCls} htmlFor="dp_nominal">
          Nominal DP (Rp)
        </label>
        <input
          id="dp_nominal"
          name="dp_nominal"
          inputMode="numeric"
          defaultValue={initial.dp_nominal ?? "50000"}
          placeholder="50000 — 0 = DP nonaktif (booking langsung tanpa tahap DP)"
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="dp_transfer_enabled"
          type="checkbox"
          name="dp_transfer_enabled"
          value="true"
          checked={transfer}
          onChange={(e) => setTransfer(e.target.checked)}
          className={checkCls}
        />
        {/* Urutan penting: checkbox dulu baru hidden — FormData.get()
            membaca "true" bila dicentang, "false" bila tidak. */}
        <input type="hidden" name="dp_transfer_enabled" value="false" />
        <label
          htmlFor="dp_transfer_enabled"
          className="text-sm font-medium text-foreground"
        >
          Bayar via Transfer Bank
        </label>
      </div>

      {transfer && (
        <div className={panelCls}>
          <div>
            <label className={labelCls} htmlFor="dp_bank">
              Nama Bank
            </label>
            <input
              id="dp_bank"
              name="dp_bank"
              defaultValue={initial.dp_bank ?? ""}
              placeholder="BCA"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="dp_account_number">
              No. Rekening
            </label>
            <input
              id="dp_account_number"
              name="dp_account_number"
              inputMode="numeric"
              defaultValue={initial.dp_account_number ?? ""}
              placeholder="1234567890"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="dp_account_name">
              Atas Nama Rekening
            </label>
            <input
              id="dp_account_name"
              name="dp_account_name"
              defaultValue={initial.dp_account_name ?? ""}
              placeholder="Bengkel Jaya"
              className={inputCls}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id="dp_qris_enabled"
          type="checkbox"
          name="dp_qris_enabled"
          value="true"
          checked={qris}
          onChange={(e) => setQris(e.target.checked)}
          className={checkCls}
        />
        <input type="hidden" name="dp_qris_enabled" value="false" />
        <label
          htmlFor="dp_qris_enabled"
          className="text-sm font-medium text-foreground"
        >
          Bayar via QRIS
        </label>
      </div>

      {qris && (
        <div className={panelCls}>
          <div className="flex items-start gap-3">
            {gambarQris ? (
              <div className="flex h-24 min-w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gambarQris}
                  alt="Gambar QRIS"
                  className="max-h-22 w-auto max-w-full object-contain"
                />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Ditampilkan di info DP customer (layar sukses booking &amp; kartu
              Menunggu DP). Margin quiet zone dipertahankan agar QR mudah
              discan — maks 1024px, dikonversi ke WebP. Gambar tersimpan
              bersamaan saat <span className="font-medium">Simpan</span> di
              bawah.
            </p>
          </div>
          <input
            type="file"
            name="qris"
            accept="image/png,image/jpeg,image/webp"
            className={fileCls}
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, atau WebP — maks 5 MB.
          </p>
          {gambarQris && (
            <div className="flex items-center gap-2">
              <input
                id="hapus_qris"
                type="checkbox"
                name="hapus_qris"
                value="true"
                className={checkCls}
              />
              <input type="hidden" name="hapus_qris" value="false" />
              <label
                htmlFor="hapus_qris"
                className="text-sm font-medium text-danger"
              >
                Hapus gambar QRIS
              </label>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id="dp_cash_enabled"
          type="checkbox"
          name="dp_cash_enabled"
          value="true"
          defaultChecked={initial.dp_cash_enabled !== "false"}
          className={checkCls}
        />
        <input type="hidden" name="dp_cash_enabled" value="false" />
        <label
          htmlFor="dp_cash_enabled"
          className="text-sm font-medium text-foreground"
        >
          Bayar Tunai (Cash)
        </label>
      </div>

      <SubmitButton
        pendingText="Menyimpan..."
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Simpan Pengaturan DP
      </SubmitButton>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
    </form>
  );
}
