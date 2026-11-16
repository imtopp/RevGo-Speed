import { formatRupiah } from "@/lib/service-status";
import type { DpConfig } from "@/lib/dp";
import { waLink, pesanKonfirmasiDp } from "@/lib/wa";
import { ClaimDpButton } from "./claim-dp-button";

/** Nama file unduhan QRIS aman untuk filesystem (huruf/angka + strip). */
function namaFileQris(appName: string): string {
  const safe = appName
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `qris-${safe || "bengkel"}.webp`;
}

/**
 * Kartu info DP booking — tampil di layar sukses booking DAN di kartu
 * "Menunggu DP" daftar /pesanan (customer boleh tutup halaman & bayar nanti).
 * Murni presentasi (tanpa directive) — aman dipakai server & client.
 */
export function DpInfoCard({
  dp,
  appName,
  waNumber,
  code,
  customerName,
  claimed,
  tplWaDp,
  id,
}: {
  dp: DpConfig;
  appName: string;
  waNumber: string | null;
  code: string;
  customerName: string;
  /** dpClaimedAt sudah terisi — tombol klaim diganti status. */
  claimed: boolean;
  /** Override template wa.konfirmasi_dp dari SystemSetting. */
  tplWaDp?: string;
  /** service.id — untuk form klaim. */
  id: string;
}) {
  const adaTransfer =
    dp.transferEnabled && !!(dp.bank || dp.accountNumber || dp.accountName);
  const adaQris = dp.qrisEnabled && !!dp.qrisImage;
  const waHref = waNumber
    ? waLink(
        waNumber,
        pesanKonfirmasiDp({
          appName,
          code,
          dp: formatRupiah(dp.nominal),
          nama: customerName || "-",
          tpl: tplWaDp,
        }),
      )
    : null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-900">
        Bayar DP {formatRupiah(dp.nominal)} — jadwal dikunci setelah DP diterima
      </p>

      {adaTransfer && (
        <div className="rounded-md bg-white p-2 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Transfer bank
          </p>
          <p className="mt-0.5 font-medium text-foreground">
            {dp.bank}
            {dp.accountNumber ? ` · ${dp.accountNumber}` : ""}
          </p>
          {dp.accountName && (
            <p className="text-xs text-muted-foreground">
              a.n. {dp.accountName}
            </p>
          )}
        </div>
      )}

      {adaQris && (
        <div className="rounded-md bg-white p-2 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            QRIS
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dp.qrisImage}
            alt="QRIS pembayaran DP"
            className="mx-auto my-2 h-40 w-auto rounded"
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href={dp.qrisImage}
              download={namaFileQris(appName)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white active:opacity-90"
            >
              Unduh QR
            </a>
          </div>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            Unduh dulu, lalu pilih gambar di aplikasi bank / e-wallet kamu.
          </p>
        </div>
      )}

      {!adaTransfer && !adaQris && waNumber && (
        <a
          href={waLink(waNumber, `Halo ${appName}, saya mau bayar DP booking ${code}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-success px-3 py-2 text-xs font-medium text-white active:opacity-90"
        >
          Hubungi bengkel untuk info pembayaran &rarr;
        </a>
      )}

      {claimed ? (
        <p className="rounded-md bg-white p-2 text-xs font-medium text-success ring-1 ring-amber-100">
          Konfirmasi pembayaran sudah ditandai — menunggu verifikasi bengkel.
        </p>
      ) : (
        <ClaimDpButton id={id} waHref={waHref} />
      )}
    </div>
  );
}
