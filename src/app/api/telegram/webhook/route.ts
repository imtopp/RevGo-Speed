import { NextResponse } from "next/server";
import { getBranding } from "@/lib/branding";
import {
  hubungkanChat,
  kirimTelegram,
  muatTelegramConfig,
  parseStartToken,
  simpanTelegramConfig,
} from "@/lib/telegram";

/**
 * Webhook Telegram Bot — menerima update dari server Telegram.
 * Autentikasi: header `X-Telegram-Bot-Api-Secret-Token` (diatur saat
 * setWebhook) harus cocok dengan `telegram_config.webhookSecret`.
 * Selalu 200 untuk update yang dikenali-abaikan agar Telegram tidak
 * mengulang kirim (retry) tanpa henti.
 */
export async function POST(req: Request) {
  try {
    const config = await muatTelegramConfig();
    if (!config.webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== config.webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const update = (await req.json()) as {
      message?: { text?: unknown; chat?: { id?: unknown } };
    };
    const token = parseStartToken(update.message?.text);
    const chatIdRaw = update.message?.chat?.id;
    if (!token || typeof chatIdRaw !== "number") {
      return NextResponse.json({ ok: true });
    }

    const hasil = hubungkanChat(config, token, String(chatIdRaw));
    if (!hasil) return NextResponse.json({ ok: true });

    await simpanTelegramConfig(hasil.config);
    const { appName } = await getBranding();
    await kirimTelegram(
      [String(chatIdRaw)],
      "Terhubung ✓",
      `Notifikasi ${appName} (booking baru & stok) akan masuk ke Telegram ini.`,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
