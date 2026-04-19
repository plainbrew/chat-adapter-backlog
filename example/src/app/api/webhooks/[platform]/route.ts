import { after } from "next/server";

import { bot } from "@/lib/bot";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];
  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }
  return handler(request, { waitUntil: (p) => after(p) });
}
