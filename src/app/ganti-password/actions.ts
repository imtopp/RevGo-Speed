"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import {
  hashPassword,
  verifyPassword,
  validasiPasswordBaru,
} from "@/lib/password";
import { logAudit } from "@/lib/audit";

export type GantiPasswordState = { error?: string };

export async function gantiPassword(
  _prev: GantiPasswordState,
  formData: FormData,
): Promise<GantiPasswordState> {
  const session = await auth();
  if (!session?.user) return { error: "Sesi berakhir. Silakan login ulang." };

  const lama = String(formData.get("lama") ?? "");
  const baru = String(formData.get("baru") ?? "");
  const konfirmasi = String(formData.get("konfirmasi") ?? "");

  const salah = validasiPasswordBaru(baru, konfirmasi);
  if (salah) return { error: salah };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  if (!user.passwordHash) return { error: "Akun ini tidak punya password." };
  if (!verifyPassword(lama, user.passwordHash)) {
    return { error: "Password lama salah." };
  }
  if (verifyPassword(baru, user.passwordHash)) {
    return { error: "Password baru harus berbeda dari password lama." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(baru), mustChangePassword: false },
    });
    await logAudit(tx, session.user, {
      action: "ACCOUNT_PASSWORD_CHANGE",
      entityType: "User",
      entityId: user.id,
      branchId: user.branchId,
      summary: `${user.name} mengganti password sendiri`,
    });
  });

  // Paksa login ulang: token lama masih membawa flag mustChange sampai
  // diganti token baru hasil login berikutnya.
  await signOut({ redirect: false });
  redirect("/login?ganti-password=berhasil");
}
