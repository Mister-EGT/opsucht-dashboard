import { auctionStreamUrl, USER_AGENT } from "@/server/opsucht-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel ends requests after 300 seconds. Close first so EventSource can
// reconnect normally and forward its Last-Event-ID instead of timing out.
const STREAM_LIFETIME_MS = 4 * 60_000;

export async function GET(request: Request) {
  const lastEventId = request.headers.get("last-event-id");
  const headers: Record<string, string> = { Accept: "text/event-stream", "User-Agent": USER_AGENT };
  if (lastEventId && lastEventId.length <= 256 && !/[\x00-\x1f\x7f]/.test(lastEventId)) {
    headers["Last-Event-ID"] = lastEventId;
  }

  const abort = new AbortController();
  const onDisconnect = () => abort.abort();
  request.signal.addEventListener("abort", onDisconnect, { once: true });
  const timer = setTimeout(() => abort.abort(), STREAM_LIFETIME_MS);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onDisconnect);
    abort.abort();
  };
  if (request.signal.aborted) abort.abort();

  try {
    const upstream = await fetch(auctionStreamUrl(), {
      headers,
      cache: "no-store",
      signal: abort.signal,
    });
    if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.toLowerCase().includes("text/event-stream")) {
      void upstream.body?.cancel().catch(() => {});
      finish();
      return new Response("Der Auktionsstream ist momentan nicht verfügbar.", { status: 502 });
    }

    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            finish();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch {
          // The lifetime limit or a disconnected client closes the stream.
          finish();
          controller.close();
        }
      },
      cancel() {
        finish();
        return reader.cancel().catch(() => {});
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    finish();
    return new Response("Der Auktionsstream ist momentan nicht verfügbar.", { status: 502 });
  }
}
