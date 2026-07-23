import type { ApiEnvelope, ApiErrorEnvelope } from "@/lib/types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(
      "Der Server hat keine lesbare JSON-Antwort geliefert.",
      response.status || 502,
      "invalid_response",
      response.status >= 500,
    );
  }
}

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) throw error;
    throw new ApiClientError(
      "Die Verbindung zum Server ist fehlgeschlagen.",
      0,
      "network_error",
      true,
    );
  }
}

export async function fetchApi<T>(url: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
  const response = await request(url, signal);
  const payload = await readJson(response);
  const errorEnvelope = isRecord(payload) && "error" in payload
    ? payload as unknown as ApiErrorEnvelope
    : null;
  if (!response.ok || errorEnvelope) {
    const error = errorEnvelope?.error;
    throw new ApiClientError(
      error?.message ?? "Die Daten konnten nicht geladen werden.",
      response.status,
      error?.code ?? "request_failed",
      error?.retryable ?? response.status >= 500,
    );
  }
  if (!isRecord(payload) || !("data" in payload) || !("meta" in payload)) {
    throw new ApiClientError(
      "Der Server hat eine unerwartete Datenstruktur geliefert.",
      response.status,
      "invalid_response",
      false,
    );
  }
  return payload as unknown as ApiEnvelope<T>;
}

export async function fetchHealth<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await request(url, signal);
  if (!response.ok) throw new ApiClientError("Der API-Status konnte nicht geladen werden.", response.status, "health_failed", true);
  return await readJson(response) as T;
}
