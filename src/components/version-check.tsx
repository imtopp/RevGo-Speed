"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_MS = 5 * 60 * 1000;
const AUTO_RELOAD_MS = 5_000;
const LOOP_GUARD_MS = 30_000;
const LOOP_KEY = "revgo-auto-reload-at";

/**
 * Wayout update: polling /api/version — saat deploy/patch baru:
 * - Halaman TERLIHAT → tidak pernah reload diam-diam; tampilkan bar
 *   "Versi baru" di ATAS (jauh dari zona jempol) agar user yang memilih
 *   kapan — tidak ada kejutan refresh, tidak ada salah ketuk.
 * - Halaman di BACKGROUND (tab/PWA pindah) → reload diam-diam, begitu
 *   user kembali sudah versi terbaru — HANYA kalau halaman belum pernah
 *   tersentuh (tanpa klik/ketik sama sekali).
 * - Sesi yang pernah ada interaksi (klik tombol, isi form, apapun) →
 *   auto-reload dikunci mati, hanya bar. Data tidak pernah hilang.
 */
export function VersionCheck() {
  const [update, setUpdate] = useState(false);
  const baseline = useRef<string | null>(null);
  const edited = useRef(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const isEditable = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el as HTMLElement).isContentEditable
      );
    };

    const cancelAuto = () => {
      if (reloadTimer.current) {
        clearTimeout(reloadTimer.current);
        reloadTimer.current = null;
      }
    };

    const showBar = () => {
      cancelAuto();
      setUpdate(true);
    };

    const fire = () => {
      reloadTimer.current = null;
      if (cancelled || edited.current || isEditable()) {
        showBar();
        return;
      }
      // Halaman sedang dilihat user → jangan refresh diam-diam, pakai bar.
      if (document.visibilityState !== "hidden") {
        showBar();
        return;
      }
      try {
        const last = Number(sessionStorage.getItem(LOOP_KEY) || 0);
        if (Date.now() - last < LOOP_GUARD_MS) {
          // Reload terlalu beruntun → berhenti di bar agar tidak jadi loop.
          showBar();
          return;
        }
        sessionStorage.setItem(LOOP_KEY, String(Date.now()));
      } catch {
        // sessionStorage tidak tersedia → tetap reload
      }
      window.location.reload();
    };

    const scheduleUpdate = () => {
      if (cancelled || reloadTimer.current || update) return;
      if (edited.current || isEditable()) {
        setUpdate(true);
        return;
      }
      reloadTimer.current = setTimeout(fire, AUTO_RELOAD_MS);
    };

    async function check() {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const v =
          typeof data === "object" && data !== null && "version" in data
            ? String((data as { version: unknown }).version ?? "")
            : "";
        if (!v || cancelled) return;
        if (baseline.current === null) {
          baseline.current = v;
          return;
        }
        if (baseline.current !== v) scheduleUpdate();
      } catch {
        // offline / server tidak terjangkau → abaikan, cek lagi nanti
      }
    }

    const markEdited = () => {
      edited.current = true;
      // Ada interaksi (ketik/klik/tap apa pun) saat auto-reload tertunda
      // → batal, ganti bar. Sesi ini dikunci: tidak akan pernah auto-reload.
      if (reloadTimer.current) showBar();
    };

    document.addEventListener("input", markEdited, true);
    document.addEventListener("change", markEdited, true);
    document.addEventListener("pointerdown", markEdited, true);
    document.addEventListener("keydown", markEdited, true);
    // Referensi disimpan supaya bisa di-remove di cleanup — tanpa ini,
    // tiap kali effect re-run (bar muncul) listener menumpuk dan handler
    // lama membawa closure `cancelled = true` (cek jadi tak pernah jalan).
    const onPageShow = () => void check();
    window.addEventListener("pageshow", onPageShow);

    check();
    const interval = setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      cancelAuto();
      clearInterval(interval);
      document.removeEventListener("input", markEdited, true);
      document.removeEventListener("change", markEdited, true);
      document.removeEventListener("pointerdown", markEdited, true);
      document.removeEventListener("keydown", markEdited, true);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [update]);

  if (!update) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 mx-auto max-w-lg px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-surface px-4 py-3 shadow-card">
        <p className="text-sm text-foreground">Versi baru tersedia.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
        >
          Muat Ulang
        </button>
      </div>
    </div>
  );
}
