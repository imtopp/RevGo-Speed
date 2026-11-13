/**
 * Diagnostik: kirim Web Push uji ke SEMUA langganan `PushSubscription`.
 * Pakai: TEST_DB (URL DB tenant), TEST_PUB, TEST_PRIV (opsional; fallback
 * .env lokal), TEST_TOPIC (opsional; default "uji") - ingat validasi topic
 * web-push (hanya [A-Za-z0-9_-], <=32 char) bila isi sendiri.
 * Hanya mencetak status OK/FAIL + kode error - TANPA key/endpoint.
 * Contoh (TBRT): $env:TEST_DB="postgres://..." ; $env:TEST_PUB="..." ;
 *   $env:TEST_PRIV="..." ; npx tsx scripts/test-push-tbrt.ts
 */
import { Client } from "pg";
import { sendNotification, setVapidDetails } from "web-push";

async function main() {
  const pub =
    process.env.TEST_PUB ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "";
  const priv = process.env.TEST_PRIV || process.env.VAPID_PRIVATE_KEY || "";
  const dbUrl = process.env.TEST_DB || "";
  if (!pub || !priv || !dbUrl) {
    console.log("CONFIG_MISSING pub=" + !!pub + " priv=" + !!priv + " db=" + !!dbUrl);
    return;
  }
  try {
    setVapidDetails("mailto:admin@revgo-speed.vercel.app", pub, priv);
  } catch (e) {
    console.log("SET_VAPID_FAIL: " + (e as Error).message.slice(0, 200));
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const r = await client.query(
    'SELECT endpoint, p256dh, auth FROM "PushSubscription" ORDER BY "createdAt"',
  );
  await client.end();
  if (!r.rows.length) {
    console.log("NO_SUB");
    return;
  }
  const rows = r.rows as { endpoint: string; p256dh: string; auth: string }[];
  const topic = process.env.TEST_TOPIC || "uji";
  let ok = 0;
  let fail = 0;
  for (const s of rows) {
    try {
      await sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: "Uji notif RevGo Speed",
          body: "Tes kirim dari server — abaikan.",
          tag: "test-" + Date.now(),
          url: "/pesanan",
        }),
        { TTL: 600, topic },
      );
      ok++;
    } catch (e) {
      const err = e as { statusCode?: number; name?: string; message?: string };
      fail++;
      console.log(
        "SEND_FAIL status=" + err.statusCode + " name=" + err.name +
          " msg=" + String(err.message || "").slice(0, 200),
      );
    }
  }
  console.log("DONE ok=" + ok + " fail=" + fail);
}

main().catch((e) => console.log("FATAL " + String(e).slice(0, 300)));
