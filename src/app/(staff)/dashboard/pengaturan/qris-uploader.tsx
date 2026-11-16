"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateSetting, uploadQris, type SettingState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Uploader gambar QRIS → SystemSetting.dp_qris_image (data URL WebP).
 * Tanpa trim margin supaya quiet zone QR tetap bisa discan.
 */
export function QrisUploader({ value }: { value: string }) {
  const [state, action] = useActionState<SettingState, FormData>(
    uploadQris,
    {},
  );
  const [hapusState, hapusAction] = useActionState<SettingState, FormData>(
    updateSetting,
    {},
  );
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) {
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    }
  }, [state.success, router]);

  useEffect(() => {
    if (hapusState.success) router.refresh();
  }, [hapusState.success, router]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Gambar QRIS</p>
      <div className="flex items-start gap-3">
        <div className="flex h-24 min-w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Gambar QRIS"
              className="max-h-22 w-auto max-w-full object-contain"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">Kosong</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Ditampilkan di info DP customer (layar sukses booking &amp; kartu
          Menunggu DP). Margin quiet zone dipertahankan agar QR mudah discan —
          resize maks 1024px, dikonversi ke WebP.
        </p>
      </div>

      <form
        onReset={(e) => e.preventDefault()}
        action={action}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <input
          ref={fileRef}
          type="file"
          name="qris"
          accept="image/png,image/jpeg,image/webp"
          required
          className="block w-full flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
        <SubmitButton
          pendingText="Memproses..."
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Upload QRIS
        </SubmitButton>
        {state.error && <p className="text-sm text-danger sm:w-full">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-success sm:w-full">{state.success}</p>
        )}
      </form>
      <p className="text-xs text-muted-foreground">PNG, JPEG, atau WebP — maks 5 MB.</p>

      {value && (
        <form onReset={(e) => e.preventDefault()} action={hapusAction}>
          <input type="hidden" name="key" value="dp_qris_image" />
          <input type="hidden" name="value" value="" />
          <button
            type="submit"
            className="text-xs font-medium text-danger underline underline-offset-2"
          >
            Hapus gambar QRIS
          </button>
          {hapusState.error && (
            <p className="mt-1 text-xs text-danger">{hapusState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
