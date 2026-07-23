import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchOpsucht, type EndpointDefinition } from "@/server/opsucht-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OPSUCHT-Proxy-Cache", () => {
  it("liefert vorhandene Daten bei einem späteren Upstreamfehler sichtbar als veraltet aus", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ value: 42 }))
      .mockResolvedValueOnce(Response.json({ message: "Fehler" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const endpoint: EndpointDefinition<{ value: number }> = {
      key: `test-stale-${Date.now()}`,
      path: "/test-stale",
      ttlMs: 1_000,
      schema: z.object({ value: z.number() }),
    };

    const live = await fetchOpsucht(endpoint, { force: true });
    expect(live).toMatchObject({ ok: true, data: { value: 42 }, meta: { source: "live", stale: false } });

    const fallback = await fetchOpsucht(endpoint, { force: true });
    expect(fallback).toMatchObject({
      ok: true,
      data: { value: 42 },
      meta: {
        source: "cache",
        stale: true,
        upstreamStatus: 400,
      },
    });
    if (fallback.ok) {
      expect(fallback.meta.error).toBeTruthy();
      expect(fallback.meta.responseTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("gibt ohne Cache ein bereinigtes und typisiertes Fehlerobjekt zurück", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 404 })));
    const endpoint: EndpointDefinition<{ value: number }> = {
      key: `test-missing-${Date.now()}`,
      path: "/test-missing",
      ttlMs: 1_000,
      schema: z.object({ value: z.number() }),
    };

    const result = await fetchOpsucht(endpoint, { force: true });
    expect(result).toMatchObject({
      ok: false,
      status: 404,
      body: {
        error: {
          code: "not_found",
          retryable: false,
        },
        meta: {
          upstreamStatus: 404,
        },
      },
    });
  });
});
