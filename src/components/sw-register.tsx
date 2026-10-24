"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // Kalau sudah ada SW aktif (update deploy), reload sekali saat SW baru
    // mengambil alih — client langsung memakai versi terbaru.
    // Install pertama (clients.claim) tidak boleh memicu reload.
    let hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    // updateViaCache "none": sw.js & import-nya selalu di-fetch segar,
    // jangan pernah ambil dari cache HTTP (browser/situs perantara).
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
