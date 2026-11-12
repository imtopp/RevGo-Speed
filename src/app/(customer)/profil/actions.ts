"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatWaLocal, normalizeWa } from "@/lib/wa";
import { revalidatePath } from "next/cache";

export type ProfilState = { error?: string; success?: string };

async function requireCustomer() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

export async function updateProfilWa(
  _prev: ProfilState,
  formData: FormData,
): Promise<ProfilState> {
  const session = await requireCustomer();
  const raw = String(formData.get("phone") ?? "").trim();

  const wa = normalizeWa(raw);
  if (!wa) {
    return {
      error:
        "No. WhatsApp tidak valid. Gunakan nomor seluler aktif, contoh: 0812xxxxxxxx.",
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone: wa },
  });

  revalidatePath("/profil");
  revalidatePath("/pesanan");
  return {
    success: `No. WhatsApp tersimpan: ${formatWaLocal(wa)} — pastikan nomor ini aktif di WhatsApp.`,
  };
}
