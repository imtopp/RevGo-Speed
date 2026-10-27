import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Ikuti host dari request (localhost / IP LAN / domain) — redirect setelah
  // login tidak lagi dipatok ke AUTH_URL sehingga akses via IP:3000 aman.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;
        // Customer walk-in tanpa akun: email/passwordHash null — tidak pernah
        // ketemuan lewat pencarian by email, tapi tetap jaga verifyPassword.
        if (!user.passwordHash) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    // Saat login (ada `user`) → isi token. Selanjutnya → segarkan role &
    // mustChange dari DB: kalau tidak, hasil edit akun (turun role, reset
    // password) baru berlaku setelah login ulang — token JWT bisa hidup
    // berminggu-minggu. DB tak terjangkau → pakai token lama (fail-soft);
    // guard tetap mengecek isActive/role terpisah untuk aksi tulis.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChange = user.mustChangePassword;
      } else if (token.id) {
        try {
          const db = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, mustChangePassword: true },
          });
          if (db) {
            token.role = db.role;
            token.mustChange = db.mustChangePassword;
          }
        } catch {
          // DB down → pertahankan klaim lama; validasi DB tetap di guard.
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChange = token.mustChange;
      return session;
    },
  },
});
