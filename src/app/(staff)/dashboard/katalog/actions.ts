"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type KatalogState = { error?: string; success?: string };

async function requireOwnerOrAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login.");
  if (!["OWNER", "SYS_ADMIN", "ADMIN"].includes(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

export async function createCatalog(
  _prev: KatalogState,
  formData: FormData,
): Promise<KatalogState> {
  await requireOwnerOrAdmin();
  const nama = String(formData.get("nama") ?? "").trim();
  const deskripsi = String(formData.get("deskripsi") ?? "").trim();
  const hargaDasar = Number(formData.get("hargaDasar") ?? 0);
  const allowDp = formData.get("allowDp") === "on";

  if (!nama) return { error: "Nama jasa wajib diisi." };
  if (hargaDasar < 0) return { error: "Harga tidak valid." };

  await prisma.serviceCatalog.create({
    data: {
      nama,
      deskripsi: deskripsi || null,
      hargaDasar,
      allowDp,
    },
  });

  revalidatePath("/dashboard/katalog");
  return { success: `Jasa "${nama}" ditambahkan.` };
}

export async function updateCatalog(
  _prev: KatalogState,
  formData: FormData,
): Promise<KatalogState> {
  await requireOwnerOrAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const nama = String(formData.get("nama") ?? "").trim();
  const deskripsi = String(formData.get("deskripsi") ?? "").trim();
  const hargaDasar = Number(formData.get("hargaDasar") ?? 0);
  const allowDp = formData.get("allowDp") === "on";
  const aktif = formData.get("aktif") === "on";

  if (!id || !nama) return { error: "Data tidak lengkap." };

  await prisma.serviceCatalog.update({
    where: { id },
    data: { nama, deskripsi: deskripsi || null, hargaDasar, allowDp, aktif },
  });

  revalidatePath("/dashboard/katalog");
  return { success: `Jasa "${nama}" diperbarui.` };
}
