"use client";

import Link, { useLinkStatus } from "next/link";

function IsiTombol({ showBooking }: { showBooking: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <span aria-live="polite">
        <span
          className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white align-[-2px]"
          aria-hidden
        />
        Memuat…
      </span>
    );
  }
  return <>{showBooking ? "Tutup Booking Servis" : "+ Booking Servis"}</>;
}

/** Tombol buka/tutup form booking admin — dengan indikator saat halaman dimuat ulang. */
export function BookingToggle({ showBooking }: { showBooking: boolean }) {
  return (
    <Link
      href={showBooking ? "/dashboard/servis" : "/dashboard/servis?booking=1"}
      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:opacity-90"
    >
      <IsiTombol showBooking={showBooking} />
    </Link>
  );
}
