/**
 * Riwayat navigasi ala native app untuk PWA mobile.
 *
 * Masalah: setiap klik <Link> menumpuk entry di history browser, jadi tombol
 * back membawa user melewati jejak lengkap (filter, cetak, form) — bukan
 * seperti app native yang memperlakukan bottom-nav sebagai "tab".
 *
 * Aturan:
 * - Pindah tab (bottom-nav / sheet "Lainnya") = runtuhkan riwayat ke Beranda
 *   dulu, lalu buka tab baru → back dari tab mana pun → Beranda.
 * - Navigasi konten (detail, form) tetap push biasa → back wajar dalam tab.
 * - Stack dilacak per sesi (pathname saja); query/toggle tidak menambah.
 *
 * Degradasi selalu aman: bila pelacakan meleset, langkah runtuh melewati
 * awal riwayat di-klamp browser ke entry pertama (tidak keluar dari app),
 * dan timeout 500ms jatuh balik ke push biasa.
 */

export const BERANDA = "/dashboard";

export type TabPlan =
  | { kind: "noop" }
  | { kind: "push" }
  | { kind: "collapse"; steps: number; skipPush: boolean };

/** Murni: putuskan langkah navigasi tab dari stack + lokasi sekarang. */
export function planTabMove(
  stack: string[],
  currentPath: string,
  href: string,
): TabPlan {
  if (stack.length === 0) return { kind: "push" };
  if (href === currentPath) return { kind: "noop" };
  const target = stack.lastIndexOf(BERANDA);
  const targetIdx = target >= 0 ? target : 0;
  // Sudah berada di Beranda (atau entry pertama) — push biasa.
  if (targetIdx >= stack.length - 1) return { kind: "push" };
  const steps = stack.length - 1 - targetIdx;
  return { kind: "collapse", steps, skipPush: href === BERANDA };
}

/**
 * Murni: "Kembali" hanya memakai history.back() bila halaman sebelumnya
 * memang targetnya (mis. detail → daftar servis); selain itu Link biasa
 * (aman untuk deep-link: [login, detail] → back = login, bukan daftar).
 */
export function shouldUseHistoryBack(stack: string[], href: string): boolean {
  return stack.length > 1 && stack[stack.length - 2] === href;
}

let stack: string[] = [];
let busy = false;
let inited = false;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPop: (() => void) | null = null;

function onPop() {
  const p = window.location.pathname;
  const i = stack.lastIndexOf(p);
  if (i === stack.length - 1) return;
  if (i >= 0) stack = stack.slice(0, i + 1);
  else stack = [p];
}

function clearPending() {
  if (pendingPop) {
    window.removeEventListener("popstate", pendingPop);
    pendingPop = null;
  }
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

export function initTabHistory() {
  if (inited) return;
  inited = true;
  stack = [window.location.pathname];
  window.addEventListener("popstate", onPop);
}

export function disposeTabHistory() {
  if (!inited) return;
  inited = false;
  window.removeEventListener("popstate", onPop);
  clearPending();
  stack = [];
  busy = false;
}

/** Panggil setiap kali pathname berubah (navigasi push terdeteksi). */
export function notePathname(pathname: string) {
  if (stack.length === 0) {
    stack = [pathname];
    return;
  }
  if (stack[stack.length - 1] !== pathname) stack.push(pathname);
}

/** Untuk BackLink: apakah ada riwayat sesi yang bisa dimundurkan? */
export function sessionCanGoBack(): boolean {
  return stack.length > 1;
}

/** Untuk BackLink: apakah entry sebelumnya persis target "Kembali"? */
export function shouldBackTo(href: string): boolean {
  return shouldUseHistoryBack(stack, href);
}

/**
 * Klik tab bottom-nav / sheet "Lainnya". Selalu dipanggil setelah
 * e.preventDefault() — navigasi dikerjakan sendiri lewat `push`.
 */
export function handleTabNavigate(
  href: string,
  push: (href: string) => void,
): void {
  if (!inited || busy) return;
  const plan = planTabMove(stack, window.location.pathname, href);
  if (plan.kind === "noop") return;
  if (plan.kind === "push") {
    push(href);
    return;
  }

  busy = true;
  const finish = () => {
    if (!busy) return;
    clearPending();
    busy = false;
    if (!plan.skipPush && window.location.pathname !== href) {
      // Push setelah pop selesai — jangan tumpang tindih dengan pemrosesan
      // popstate Next.js.
      setTimeout(() => push(href), 0);
    }
  };
  pendingPop = () => finish();
  pendingTimer = setTimeout(() => {
    // popstate tidak pernah datang (langkah melewati awal riwayat) → stack
    // tidak tahu posisi; reset konservatif agar langkah berikutnya benar.
    stack = [window.location.pathname];
    finish();
  }, 500);
  window.addEventListener("popstate", pendingPop);
  window.history.go(-plan.steps);
}
