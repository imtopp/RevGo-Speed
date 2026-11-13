"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushEnabled } from "@/lib/push";

export type PushSubState = {
  error?: string;
  success?: string;
};

/** ROLE yang boleh menyimpan langganan push di akunnya. */
const BOLEH_LANGGANAN = ["OWNER", "ADMIN", "CUSTOMER"];

/**
 * Simpan/upsert langganan Web Push (1 baris per endpoint = per device).
 * Dipanggil dari kartu opt-in setelah `pushManager.subscribe()` sukses.
 */
export async function savePushSubscription(
  _prev: PushSubState,
  formData: FormData,
): Promise<PushSubState> {
  try {
    if (!pushEnabled()) {
      return { error: "Notifikasi belum diaktifkan oleh pengaturan bengkel." };
    }
    const session = await auth();
    const user = session?.user;
    if (!user || !BOLEH_LANGGANAN.includes(user.role)) {
      return { error: "Tidak punya akses." };
    }
    // JWT bisa hidup 30 hari — akun nonaktif harus langsung terblokir.
    const db = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true },
    });
    if (!db?.isActive) return { error: "Akun tidak aktif." };

    const endpoint = String(formData.get("endpoint") ?? "").trim();
    const p256dh = String(formData.get("p256dh") ?? "").trim();
    const authKey = String(formData.get("auth") ?? "").trim();
    const userAgent = String(formData.get("userAgent") ?? "").trim() || null;

    if (
      !endpoint.startsWith("https://") ||
      endpoint.length > 2048 ||
      !p256dh ||
      !authKey
    ) {
      return { error: "Data langganan tidak valid." };
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh, auth: authKey, userAgent },
      update: {
        userId: user.id,
        p256dh,
        auth: authKey,
        userAgent,
        lastSeenAt: new Date(),
      },
    });
    return { success: "Notifikasi aktif di perangkat ini." };
  } catch {
    return { error: "Gagal mengaktifkan notifikasi. Coba lagi." };
  }
}

/** Hapus langganan endpoint ini milik user yang sedang login. */
export async function removePushSubscription(
  _prev: PushSubState,
  formData: FormData,
): Promise<PushSubState> {
  try {
    const session = await auth();
    if (!session?.user) return { error: "Tidak punya akses." };
    const endpoint = String(formData.get("endpoint") ?? "").trim();
    if (!endpoint) return { error: "Data langganan tidak valid." };
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });
    return { success: "Notifikasi dimatikan di perangkat ini." };
  } catch {
    return { error: "Gagal mematikan notifikasi. Coba lagi." };
  }
}
