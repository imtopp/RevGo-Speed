import { describe, expect, it } from "vitest";
import { validasiAssignCabang, validasiCabangBaru } from "./staff-branch";

describe("validasiCabangBaru", () => {
  it("Admin/Mekanik wajib punya cabang", () => {
    expect(validasiCabangBaru("ADMIN", "")).toBe("Admin/Mekanik wajib pilih cabang.");
    expect(validasiCabangBaru("MECHANIC", "")).toBe("Admin/Mekanik wajib pilih cabang.");
    expect(validasiCabangBaru("ADMIN", "br-1")).toBeNull();
    expect(validasiCabangBaru("MECHANIC", "br-1")).toBeNull();
  });

  it("SysAdmin boleh lintas cabang (cabang kosong)", () => {
    expect(validasiCabangBaru("SYS_ADMIN", "")).toBeNull();
    expect(validasiCabangBaru("SYS_ADMIN", "br-1")).toBeNull();
  });
});

describe("validasiAssignCabang", () => {
  it("Owner & SysAdmin tidak bisa di-assign (memang lintas cabang)", () => {
    expect(validasiAssignCabang("OWNER", "")).toBe(
      "Owner & SysAdmin lintas cabang, tidak di-assign.",
    );
    expect(validasiAssignCabang("SYS_ADMIN", "br-1")).toBe(
      "Owner & SysAdmin lintas cabang, tidak di-assign.",
    );
  });

  it("Customer ditolak — bukan urusan cabang", () => {
    expect(validasiAssignCabang("CUSTOMER", "")).toBe(
      "Akun customer tidak di-assign cabang.",
    );
    expect(validasiAssignCabang("CUSTOMER", "br-1")).toBe(
      "Akun customer tidak di-assign cabang.",
    );
  });

  it("Admin/Mekanik wajib pilih cabang — tidak boleh lintas", () => {
    expect(validasiAssignCabang("ADMIN", "")).toBe(
      "Admin/Mekanik wajib pilih cabang.",
    );
    expect(validasiAssignCabang("MECHANIC", "")).toBe(
      "Admin/Mekanik wajib pilih cabang.",
    );
    expect(validasiAssignCabang("ADMIN", "br-9")).toBeNull();
    expect(validasiAssignCabang("MECHANIC", "br-9")).toBeNull();
  });
});
