import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/opsucht/auctions/stream/route";

afterEach(() => vi.unstubAllGlobals());

describe("Auktionsstream-Proxy", () => {
  it("reicht SSE und die zuletzt empfangene Event-ID unverändert weiter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("id: 12\nevent: auction.created\ndata: {}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/opsucht/auctions/stream", {
      headers: { "Last-Event-ID": "11" },
    });
    const response = await GET(request);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auctions\/stream$/),
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "text/event-stream", "Last-Event-ID": "11" }), signal: request.signal }),
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("auction.created");
  });

  it("gibt bei fehlendem Event-Stream keine interne Upstream-Antwort weiter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ secret: "intern" })));
    const response = await GET(new Request("http://localhost/api/opsucht/auctions/stream"));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("intern");
  });
});
