"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    // AuthError = kredensial salah. NEXT_REDIRECT (sign-in sukses / redirect
    // error NextAuth) wajib diteruskan, jangan ditelan.
    if (err instanceof AuthError) {
      return { error: "Email atau password salah." };
    }
    throw err;
  }
  return {};
}
