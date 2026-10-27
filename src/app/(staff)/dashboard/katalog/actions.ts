"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertActiveUser } from "@/lib/guard";
import { revalidatePath } from "next/cache";

export type KatalogState = { error?: string; success?: string };

const DURASI_MIN = 5;
const DURASI_MAX = 1440;

function bacaEstimasiMenit(formData: FormData): number | null {
  const raw = String(formData.get("estimasiMenit") ?? "").trim();
  if (!raw) return 60;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < DURASI_MIN || n > DURASI_MAX) return null;
  return n;
}

async function requireOwnerOrAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login.");
  if (!["OWNER", "SYS_ADMIN"].includes(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  await assertActiveUser(session.user.id);
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
  const estimasiMenit = bacaEstimasiMenit(formData);

  if (!nama) return { error: "Nama jasa wajib diisi." };
  if (hargaDasar < 0) return { error: "Harga tidak valid." };
  if (estimasiMenit === null) {
    return { error: `Estimasi durasi harus ${DURASI_MIN}–${DURASI_MAX} menit.` };
  }

  await prisma.serviceCatalog.create({
    data: {
      nama,
      deskripsi: deskripsi || null,
      hargaDasar,
      allowDp,
      estimasiMenit,
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
  const estimasiMenit = bacaEstimasiMenit(formData);

  if (!id || !nama) return { error: "Data tidak lengkap." };
  if (hargaDasar < 0) return { error: "Harga tidak valid." };
  if (estimasiMenit === null) {
    return { error: `Estimasi durasi harus ${DURASI_MIN}–${DURASI_MAX} menit.` };
  }

  await prisma.serviceCatalog.update({
    where: { id },
    data: {
      nama,
      deskripsi: deskripsi || null,
      hargaDasar,
      allowDp,
      estimasiMenit,
      aktif,
    },
  });

  revalidatePath("/dashboard/katalog");
  return { success: `Jasa "${nama}" diperbarui.` };
}
