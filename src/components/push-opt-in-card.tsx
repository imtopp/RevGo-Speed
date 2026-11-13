"use client";

/**
 * Kartu izin Web Push — dipasang di Beranda staff (OWNER/ADMIN) & Pesanan
 * (customer). Izin SELALU diminta dari tap tombol (syarat iOS) — tidak ada
 * requestPermission otomatis saat halaman dimuat.
 */

import { useEffect, useState } from "react";
import {
  removePushSubscription,
  savePushSubscription,
  type PushSubState,
} from "@/lib/push-actions";

type Fase = "cek" | "nonprod" | "mati" | "tolak" | "off" | "on";

const DISMISSED_KEY = "revgo-push-dismissed";

function ubahKeUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushOptInCard({
  enabled,
  konteks,
}: {
  /** false = env VAPID belum ada → kartu tidak dirender sama sekali. */
  enabled: boolean;
  konteks: "staff" | "customer";
}) {
  const [fase, setFase] = useState<Fase>("cek");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ teks: string; jenis: "ok" | "err" } | null>(
    null,
  );

  useEffect(() => {
    let batal = false;
    // Async agar setFase tidak sinkron di dalam effect (hindari cascading render).
    (async () => {
      if (!enabled) return;
      if (
        process.env.NODE_ENV !== "production" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!batal) setFase("nonprod");
        return;
      }
      if (localStorage.getItem(DISMISSED_KEY)) {
        if (!batal) setFase("mati");
        return;
      }
      if (Notification.permission === "denied") {
        if (!batal) setFase("tolak");
        return;
      }
      try {
        // `ready` bisa menggantung bila registrasi SW gagal — timeout 5 dtk →
        // fallback "off" (tombol Aktifkan mendaftarkan SW sendiri).
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (batal) return;
        setFase(sub ? "on" : "off");
      } catch {
        if (!batal) setFase("off");
      }
    })();
    return () => {
      batal = true;
    };
  }, [enabled]);

  if (!enabled || fase === "cek" || fase === "mati") return null;

  const nanti = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setFase("mati");
  };

  const aktifkan = async () => {
    setBusy(true);
    setPesan(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setFase("tolak");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });
      const reg = await navigator.serviceWorker.ready;
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        setPesan({ teks: "Notifikasi belum dikonfigurasi.", jenis: "err" });
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: ubahKeUint8Array(pub),
      });
      const json = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", json.endpoint ?? "");
      fd.set("p256dh", json.keys?.p256dh ?? "");
      fd.set("auth", json.keys?.auth ?? "");
      fd.set("userAgent", navigator.userAgent);
      const res: PushSubState = await savePushSubscription({}, fd);
      if (res.error) {
        await sub.unsubscribe().catch(() => undefined);
        setPesan({ teks: res.error, jenis: "err" });
        return;
      }
      setFase("on");
      setPesan({ teks: res.success ?? "Notifikasi aktif.", jenis: "ok" });
    } catch {
      setPesan({
        teks: "Gagal mengaktifkan notifikasi. Coba lagi.",
        jenis: "err",
      });
    } finally {
      setBusy(false);
    }
  };

  const matikan = async () => {
    setBusy(true);
    setPesan(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set("endpoint", sub.endpoint);
        await removePushSubscription({}, fd);
        await sub.unsubscribe().catch(() => undefined);
      }
      setFase("off");
      setPesan({ teks: "Notifikasi dimatikan di perangkat ini.", jenis: "ok" });
    } catch {
      setPesan({ teks: "Gagal mematikan notifikasi.", jenis: "err" });
    } finally {
      setBusy(false);
    }
  };

  const deskripsi =
    konteks === "staff"
      ? "Booking baru & stok menipis langsung muncul di HP — walau aplikasi tertutup."
      : "Estimasi, jadwal, pembatalan & servis selesai langsung muncul di HP.";

  return (
    <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold text-secondary">
          Notifikasi HP
        </h2>
        <p className="text-sm text-muted-foreground">{deskripsi}</p>
      </div>

      {fase === "nonprod" ? (
        <p className="text-sm text-muted-foreground">
          Notifikasi tersedia di aplikasi terpasang (bukan mode uji).
        </p>
      ) : fase === "tolak" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Izin notifikasi diblokir. Aktifkan lewat Pengaturan HP: situs ini →
            Notifikasi → Izinkan, lalu muat ulang halaman.
          </p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(DISMISSED_KEY);
              setFase("off");
            }}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-secondary"
          >
            Mengerti
          </button>
        </div>
      ) : fase === "on" ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-success">Notifikasi aktif di perangkat ini.</p>
          <button
            type="button"
            onClick={matikan}
            disabled={busy}
            className="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50"
          >
            {busy ? "…" : "Matikan"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={aktifkan}
              disabled={busy}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : "Aktifkan Notifikasi"}
            </button>
            <button
              type="button"
              onClick={nanti}
              disabled={busy}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground"
            >
              Nanti
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <p
          className={`text-sm ${pesan.jenis === "ok" ? "text-success" : "text-danger"}`}
        >
          {pesan.teks}
        </p>
      )}
    </section>
  );
}
