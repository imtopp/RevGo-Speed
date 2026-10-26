"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateSetting, uploadLogo, type SettingState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export function LogoUploader({ value }: { value: string }) {
  const [state, action] = useActionState<SettingState, FormData>(
    uploadLogo,
    {},
  );
  const [urlState, urlAction] = useActionState<SettingState, FormData>(
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
    if (urlState.success) router.refresh();
  }, [urlState.success, router]);

  const showUrl = value && !value.startsWith("data:");
  const urlDefault = showUrl ? value : "";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Logo Aplikasi</p>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo aplikasi" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Kosong</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Tampil di header, halaman login, dan nota. File diproses otomatis:
          di-resize maks 512px lalu dikonversi ke WebP.
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
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="block w-full flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
        <SubmitButton
          pendingText="Memproses..."
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Upload &amp; Proses
        </SubmitButton>
        {state.error && <p className="text-sm text-danger sm:w-full">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-success sm:w-full">{state.success}</p>
        )}
      </form>
      <p className="text-xs text-muted-foreground">
        PNG, JPEG, WebP, atau SVG — maks 5 MB.
      </p>

      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          …atau pakai URL gambar
        </summary>
        <form
          onReset={(e) => e.preventDefault()}
          action={urlAction}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <input type="hidden" name="key" value="logo_url" />
          <div className="flex-1">
            <input
              name="value"
              defaultValue={urlDefault}
              placeholder="https://.../logo-bengkel.png"
              className={inputCls}
            />
          </div>
          <SubmitButton
            pendingText="Simpan..."
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            Simpan URL
          </SubmitButton>
          {urlState.error && (
            <p className="text-sm text-danger sm:w-full">{urlState.error}</p>
          )}
          {urlState.success && (
            <p className="text-sm text-success sm:w-full">{urlState.success}</p>
          )}
        </form>
      </details>
    </div>
  );
}
