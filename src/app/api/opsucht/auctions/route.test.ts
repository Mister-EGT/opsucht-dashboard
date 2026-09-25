import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/opsucht/auctions/route";

afterEach(() => vi.unstubAllGlobals());

describe("Auktions-Snapshot nach Stream-Reset", () => {
  it("umgeht den bestehenden 30-Sekunden-Cache nur bei expliziter Synchronisierung", async () => {
    const upstream = vi.fn().mockImplementation(async () => Response.json([]));
    vi.stubGlobal("fetch", upstream);
    const category = `stream_reset_${Date.now()}`;
    const url = `http://localhost/api/opsucht/auctions?category=${category}`;

    expect((await GET(new Request(url))).status).toBe(200);
    expect((await GET(new Request(url))).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);

    const refreshed = await GET(new Request(`${url}&refresh=1`));
    expect(refreshed.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect((await refreshed.json()).meta.source).toBe("live");
  });

  it("weist andere Werte für refresh zurück", async () => {
    const response = await GET(new Request("http://localhost/api/opsucht/auctions?refresh=yes"));
    expect(response.status).toBe(400);
  });
});
