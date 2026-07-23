import type { z } from "zod";
import {
  auctionCategoriesSchema,
  auctionsSchema,
  marketCategoriesSchema,
  marketHistorySchema,
  marketItemsSchema,
  marketPriceSchema,
  marketPricesSchema,
  merchantRatesSchema,
  type Auction,
  type AuctionCategory,
  type MarketCategory,
  type MarketHistoryResponse,
  type MarketItem,
  type MarketPriceResponse,
  type MarketPricesResponse,
  type MerchantRate,
} from "@/lib/schemas";
import type { ApiErrorEnvelope, ApiMeta } from "@/lib/types";

const API_BASE_URL = process.env.OPSUCHT_API_BASE_URL ?? "https://api.opsucht.net";
const USER_AGENT =
  process.env.OPSUCHT_API_USER_AGENT ??
  "OPSUCHT-Economy-Dashboard/1.0 (+community-dashboard)";

export const CACHE_TTL = {
  auctions: 30_000,
  auctionCategories: 30 * 60_000,
  marketPrices: 60_000,
  marketItems: 30 * 60_000,
  marketCategories: 30 * 60_000,
  marketPrice: 60_000,
  marketHistory: 5 * 60_000,
  merchantRates: 60_000,
} as const;

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const MAX_CACHE_ENTRIES = 512;
const MAX_METRIC_ENTRIES = 1_024;

export interface EndpointDefinition<T> {
  key: string;
  path: string;
  ttlMs: number;
  schema: z.ZodType<T>;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  fetchedAt: number;
  expiresAt: number;
  responseTimeMs: number;
  upstreamStatus: number;
}

interface EndpointMetric {
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
}

type Success<T> = { ok: true; data: T; meta: ApiMeta };
type Failure = {
  ok: false;
  status: number;
  body: ApiErrorEnvelope;
};

export type OpsuchtResult<T> = Success<T> | Failure;

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly responseTimeMs: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

type GlobalOpsuchtState = typeof globalThis & {
  __opsuchtCache?: Map<string, CacheEntry<unknown>>;
  __opsuchtMetrics?: Map<string, EndpointMetric>;
  __opsuchtInflight?: Map<string, Promise<OpsuchtResult<unknown>>>;
};

const globalState = globalThis as GlobalOpsuchtState;
const cache = (globalState.__opsuchtCache ??= new Map());
const metrics = (globalState.__opsuchtMetrics ??= new Map());
const inflight = (globalState.__opsuchtInflight ??= new Map());

function metricFor(key: string): EndpointMetric {
  const current = metrics.get(key);
  if (current) {
    metrics.delete(key);
    metrics.set(key, current);
    return current;
  }
  const created: EndpointMetric = {
    lastSuccessAt: null,
    lastErrorAt: null,
  };
  if (metrics.size >= MAX_METRIC_ENTRIES) {
    const oldestKey = metrics.keys().next().value;
    if (oldestKey !== undefined) metrics.delete(oldestKey);
  }
  metrics.set(key, created);
  return created;
}

function readCache<T>(key: string): CacheEntry<T> | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry) {
    cache.delete(key);
    cache.set(key, entry);
  }
  return entry;
}

function writeCache<T>(key: string, entry: CacheEntry<T>): void {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function publicErrorMessage(status: number): string {
  if (status === 404) return "Für diese Auswahl sind keine Daten vorhanden.";
  if (status === 408 || status === 504) return "Die OPSUCHT-API hat nicht rechtzeitig geantwortet.";
  if (status === 429) return "Die OPSUCHT-API begrenzt Anfragen vorübergehend.";
  if (status >= 500) return "Der OPSUCHT-Datenbereich ist vorübergehend nicht verfügbar.";
  return "Die OPSUCHT-Daten konnten nicht geladen werden.";
}

function errorCode(status: number): string {
  if (status === 404) return "not_found";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limited";
  return "upstream_unavailable";
}

function iso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function createMeta(
  definition: EndpointDefinition<unknown>,
  entry: CacheEntry<unknown>,
  source: "live" | "cache",
  options?: { stale?: boolean; error?: string; status?: number; responseTimeMs?: number },
): ApiMeta {
  const now = Date.now();
  const metric = metricFor(definition.key);
  return {
    key: definition.key,
    source,
    stale: options?.stale ?? now > entry.expiresAt,
    cachedAt: new Date(entry.cachedAt).toISOString(),
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    lastSuccessAt: iso(metric.lastSuccessAt),
    lastErrorAt: iso(metric.lastErrorAt),
    responseTimeMs: options?.responseTimeMs ?? entry.responseTimeMs,
    upstreamStatus: options?.status ?? entry.upstreamStatus,
    ageMs: Math.max(0, now - entry.cachedAt),
    ttlMs: definition.ttlMs,
    ...(options?.error ? { error: options.error } : {}),
  };
}

async function waitForRetry(attempt: number): Promise<void> {
  const delay = 250 * 2 ** attempt + Math.floor(Math.random() * 100);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchOnce<T>(definition: EndpointDefinition<T>): Promise<{
  data: T;
  status: number;
  responseTimeMs: number;
}> {
  const startedAt = performance.now();
  const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${definition.path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new UpstreamError(
      timedOut ? "Zeitüberschreitung" : "Netzwerkfehler",
      timedOut ? 504 : 502,
      true,
      elapsed(),
    );
  }

  if (!response.ok) {
    throw new UpstreamError(
      `HTTP ${response.status}`,
      response.status,
      response.status === 429 || response.status >= 500,
      elapsed(),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new UpstreamError("Ungültige JSON-Antwort", 502, false, elapsed());
  }

  const parsed = definition.schema.safeParse(payload);
  if (!parsed.success) {
    throw new UpstreamError("Unerwartete Datenstruktur", 502, false, elapsed());
  }

  return { data: parsed.data, status: response.status, responseTimeMs: elapsed() };
}

async function performFetch<T>(
  definition: EndpointDefinition<T>,
  force: boolean,
): Promise<OpsuchtResult<T>> {
  const now = Date.now();
  const cached = readCache<T>(definition.key);

  if (!force && cached && cached.expiresAt > now) {
    return {
      ok: true,
      data: cached.data,
      meta: createMeta(definition, cached, "cache"),
    };
  }

  const metric = metricFor(definition.key);
  let lastError = new UpstreamError("Unbekannter Fehler", 502, false, 0);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchOnce(definition);
      const fetchedAt = Date.now();
      const entry: CacheEntry<T> = {
        data: response.data,
        cachedAt: fetchedAt,
        fetchedAt,
        expiresAt: fetchedAt + definition.ttlMs,
        responseTimeMs: response.responseTimeMs,
        upstreamStatus: response.status,
      };
      writeCache(definition.key, entry);
      metric.lastSuccessAt = fetchedAt;
      return {
        ok: true,
        data: response.data,
        meta: createMeta(definition, entry, "live"),
      };
    } catch (error) {
      lastError =
        error instanceof UpstreamError
          ? error
          : new UpstreamError("Unerwarteter Serverfehler", 502, false, 0);
      if (!lastError.retryable || attempt === MAX_ATTEMPTS - 1) break;
      await waitForRetry(attempt);
    }
  }

  const failedAt = Date.now();
  metric.lastErrorAt = failedAt;

  if (cached) {
    return {
      ok: true,
      data: cached.data,
      meta: createMeta(definition, cached, "cache", {
        stale: true,
        error: publicErrorMessage(lastError.status),
        status: lastError.status,
        responseTimeMs: lastError.responseTimeMs,
      }),
    };
  }

  const responseStatus = lastError.status === 404 ? 404 : 502;
  return {
    ok: false,
    status: responseStatus,
    body: {
      error: {
        code: errorCode(lastError.status),
        message: publicErrorMessage(lastError.status),
        retryable: lastError.retryable,
      },
      meta: {
        key: definition.key,
        stale: false,
        lastSuccessAt: iso(metric.lastSuccessAt),
        lastErrorAt: iso(metric.lastErrorAt),
        responseTimeMs: lastError.responseTimeMs,
        upstreamStatus: lastError.status,
        ttlMs: definition.ttlMs,
      },
    },
  };
}

export async function fetchOpsucht<T>(
  definition: EndpointDefinition<T>,
  options: { force?: boolean } = {},
): Promise<OpsuchtResult<T>> {
  const existing = inflight.get(definition.key) as Promise<OpsuchtResult<T>> | undefined;
  if (existing) return existing;

  const request = performFetch(definition, options.force ?? false).finally(() => {
    inflight.delete(definition.key);
  });
  inflight.set(definition.key, request as Promise<OpsuchtResult<unknown>>);
  return request;
}

export const staticEndpoints = {
  auctions: {
    key: "auctions",
    path: "/auctions/active",
    ttlMs: CACHE_TTL.auctions,
    schema: auctionsSchema,
  } satisfies EndpointDefinition<Auction[]>,
  auctionCategories: {
    key: "auction-categories",
    path: "/auctions/categories",
    ttlMs: CACHE_TTL.auctionCategories,
    schema: auctionCategoriesSchema,
  } satisfies EndpointDefinition<AuctionCategory[]>,
  marketCategories: {
    key: "market-categories",
    path: "/market/categories",
    ttlMs: CACHE_TTL.marketCategories,
    schema: marketCategoriesSchema,
  } satisfies EndpointDefinition<MarketCategory[]>,
  marketItems: {
    key: "market-items",
    path: "/market/items",
    ttlMs: CACHE_TTL.marketItems,
    schema: marketItemsSchema,
  } satisfies EndpointDefinition<MarketItem[]>,
  marketPrices: {
    key: "market-prices",
    path: "/market/prices",
    ttlMs: CACHE_TTL.marketPrices,
    schema: marketPricesSchema,
  } satisfies EndpointDefinition<MarketPricesResponse>,
  merchantRates: {
    key: "merchant-rates",
    path: "/merchant/rates",
    ttlMs: CACHE_TTL.merchantRates,
    schema: merchantRatesSchema,
  } satisfies EndpointDefinition<MerchantRate[]>,
};

export function auctionEndpoint(category?: string): EndpointDefinition<Auction[]> {
  if (!category) return staticEndpoints.auctions;
  return {
    key: `auctions:${category}`,
    path: `/auctions/active?category=${encodeURIComponent(category)}`,
    ttlMs: CACHE_TTL.auctions,
    schema: auctionsSchema,
  };
}

export function marketPriceEndpoint(material: string): EndpointDefinition<MarketPriceResponse> {
  return {
    key: `market-price:${material}`,
    path: `/market/price/${encodeURIComponent(material)}`,
    ttlMs: CACHE_TTL.marketPrice,
    schema: marketPriceSchema,
  };
}

export function marketHistoryEndpoint(material: string): EndpointDefinition<MarketHistoryResponse> {
  return {
    key: `market-history:${material}`,
    path: `/market/history/${encodeURIComponent(material)}`,
    ttlMs: CACHE_TTL.marketHistory,
    schema: marketHistorySchema,
  };
}
