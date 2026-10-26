/**
 * Aturan penempatan cabang akun (semua cabang terkait role, bukan UI).
 * - Owner & SysAdmin: lintas cabang (branchId selalu null, tidak di-assign).
 * - Admin & Mekanik: wajib terikat tepat 1 cabang.
 * - Customer: bukan staf — tidak di-assign cabang.
 */

/** Validasi saat MEMBUAT akun staff baru. null = valid. */
export function validasiCabangBaru(role: string, branchId: string): string | null {
  if ((role === "ADMIN" || role === "MECHANIC") && !branchId) {
    return "Admin/Mekanik wajib pilih cabang.";
  }
  return null;
}

/** Validasi saat ASSIGN / mengubah cabang user. null = valid. */
export function validasiAssignCabang(role: string, branchId: string): string | null {
  if (role === "OWNER" || role === "SYS_ADMIN") {
    return "Owner & SysAdmin lintas cabang, tidak di-assign.";
  }
  if (role === "CUSTOMER") return "Akun customer tidak di-assign cabang.";
  if (!branchId) return "Admin/Mekanik wajib pilih cabang.";
  return null;
}
