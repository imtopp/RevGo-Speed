// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

// React 19 memanggil form.reset() setiap kali form action selesai (sukses
// maupun gagal). form.reset() membakar event "reset" yang cancelable —
// handler onReset yang preventDefault() membatalkan pengosongan isian.
describe("onReset preventDefault vs auto-reset React 19", () => {
  it("mempertahankan isian form saat reset dibatalkan", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(() => {
      root.render(
        <form onReset={(e) => e.preventDefault()}>
          <input name="sku" defaultValue="OLI-001" />
          <input type="checkbox" name="consignment" defaultChecked />
        </form>,
      );
    });

    const form = host.querySelector("form")!;
    const sku = host.querySelector<HTMLInputElement>('input[name="sku"]')!;
    const consignment = host.querySelector<HTMLInputElement>(
      'input[name="consignment"]',
    )!;

    await act(() => {
      sku.value = "OLI-BARU-DIISI";
      form.reset(); // cara React 19 me-reset form setelah action
    });

    expect(sku.value).toBe("OLI-BARU-DIISI"); // isian pengguna bertahan
    expect(consignment.checked).toBe(true); // centang konsinyasi tidak "hilang"
    root.unmount();
    host.remove();
  });

  it("tanpa preventDefault, isian ikut ter-reset (perilaku bawaan React 19)", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(() => {
      root.render(
        <form>
          <input name="sku" defaultValue="OLI-001" />
        </form>,
      );
    });

    const form = host.querySelector("form")!;
    const sku = host.querySelector<HTMLInputElement>('input[name="sku"]')!;

    sku.value = "DIUBAH-PENGGUNA";
    await act(() => {
      form.reset();
    });

    expect(sku.value).toBe("OLI-001"); // tanpa preventDefault: isi hilang
    root.unmount();
    host.remove();
  });
});
