import { NextResponse } from "next/server";
import { normalizeMinecraftUuid } from "@/lib/minecraft-player";
import { resolveMinecraftPlayer } from "@/server/minecraft-player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=43200",
  "X-Robots-Tag": "noindex",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const uuid = normalizeMinecraftUuid((await params).uuid);
  if (!uuid) {
    return NextResponse.json(
      { error: { code: "invalid_uuid", message: "Die Minecraft-UUID ist ungültig.", retryable: false } },
      { status: 400, headers },
    );
  }

  return NextResponse.json(await resolveMinecraftPlayer(uuid), { headers });
}
