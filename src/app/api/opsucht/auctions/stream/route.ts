import { auctionStreamUrl, USER_AGENT } from "@/server/opsucht-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const lastEventId = request.headers.get("last-event-id");
  const headers: Record<string, string> = { Accept: "text/event-stream", "User-Agent": USER_AGENT };
  if (lastEventId && lastEventId.length <= 256 && !/[\x00-\x1f\x7f]/.test(lastEventId)) {
    headers["Last-Event-ID"] = lastEventId;
  }

  try {
    const upstream = await fetch(auctionStreamUrl(), {
      headers,
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.toLowerCase().includes("text/event-stream")) {
      upstream.body?.cancel().catch(() => {});
      return new Response("Der Auktionsstream ist momentan nicht verfügbar.", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response("Der Auktionsstream ist momentan nicht verfügbar.", { status: 502 });
  }
}
