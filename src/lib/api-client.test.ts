import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApi, fetchHealth } from "@/lib/api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API-Client", () => {
  it("wandelt nicht lesbares JSON in einen kontrollierten Clientfehler um", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("kein json", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    })));

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 502,
      code: "invalid_response",
    });
  });

  it("weist erfolgreiche Antworten ohne Envelope zurück", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(["unerwartet"])));

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      status: 200,
      code: "invalid_response",
      retryable: false,
    });
  });

  it("behält verständliche Proxyfehler und deren Retry-Hinweis bei", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      error: {
        code: "rate_limited",
        message: "Vorübergehend begrenzt.",
        retryable: true,
      },
    }, { status: 502 })));

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      message: "Vorübergehend begrenzt.",
      status: 502,
      code: "rate_limited",
      retryable: true,
    });
  });

  it("behandelt auch unlesbare Health-Antworten kontrolliert", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));

    await expect(fetchHealth("/api/health")).rejects.toMatchObject({
      status: 200,
      code: "invalid_response",
    });
  });

  it("behält abgebrochene Anfragen als Abbruch erkennbar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("abgebrochen", "AbortError")));

    await expect(fetchApi("/api/test")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("wandelt Netzwerkfehler in einen kontrollierten, wiederholbaren Fehler um", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 0,
      code: "network_error",
      retryable: true,
    });
  });
});
