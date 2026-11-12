"use server";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { normalizeWa } from "@/lib/wa";
import { redirect } from "next/navigation";

export type RegisterState = { error?: string };

export async function registerCustomer(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email) {
    return { error: "Nama dan email wajib diisi." };
  }
  const phone = normalizeWa(phoneRaw);
  if (!phone) {
    return {
      error:
        "No. WhatsApp wajib diisi dengan nomor seluler yang aktif. Contoh: 0812xxxxxxxx.",
    };
  }
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email sudah terdaftar." };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash: hashPassword(password),
      role: "CUSTOMER",
    },
  });

  redirect("/login?registered=1");
}
