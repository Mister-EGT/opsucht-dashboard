import { NextResponse } from "next/server";
import {
  fetchOpsucht,
  marketHistoryEndpoint,
  marketPriceEndpoint,
  staticEndpoints,
  type EndpointDefinition,
  type OpsuchtResult,
} from "@/server/opsucht-api";
import type { HealthEndpoint, HealthResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const checks = [
  { label: "Aktive Auktionen", path: "/auctions/active", endpoint: staticEndpoints.auctions },
  { label: "Auktionskategorien", path: "/auctions/categories", endpoint: staticEndpoints.auctionCategories },
  { label: "Marktkategorien", path: "/market/categories", endpoint: staticEndpoints.marketCategories },
  { label: "Marktitems", path: "/market/items", endpoint: staticEndpoints.marketItems },
  { label: "Alle Marktpreise", path: "/market/prices", endpoint: staticEndpoints.marketPrices },
  { label: "Itempreis", path: "/market/price/ACACIA_LEAVES", endpoint: marketPriceEndpoint("ACACIA_LEAVES") },
  { label: "Preisverlauf", path: "/market/history/ACACIA_LEAVES", endpoint: marketHistoryEndpoint("ACACIA_LEAVES") },
  { label: "Händlerkurse", path: "/merchant/rates", endpoint: staticEndpoints.merchantRates },
] as const;

function toHealthEndpoint(
  label: string,
  path: string,
  key: string,
  result: OpsuchtResult<unknown>,
  checkedAt: string,
): HealthEndpoint {
  if (!result.ok) {
    return {
      key,
      label,
      path,
      reachable: false,
      status: result.body.meta?.upstreamStatus ?? result.status,
      responseTimeMs: result.body.meta?.responseTimeMs ?? 0,
      lastSuccessAt: result.body.meta?.lastSuccessAt ?? null,
      lastErrorAt: result.body.meta?.lastErrorAt ?? checkedAt,
      cacheStatus: "none",
      stale: false,
      dataAgeMs: null,
      checkedAt,
      message: result.body.error.message,
    };
  }

  return {
    key,
    label,
    path,
    reachable: !result.meta.error,
    status: result.meta.upstreamStatus,
    responseTimeMs: result.meta.responseTimeMs,
    lastSuccessAt: result.meta.lastSuccessAt,
    lastErrorAt: result.meta.lastErrorAt,
    cacheStatus: result.meta.source,
    stale: result.meta.stale,
    dataAgeMs: result.meta.ageMs,
    checkedAt,
    message: result.meta.error ?? "Endpunkt erreichbar",
  };
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(
    checks.map((check) => fetchOpsucht(check.endpoint as EndpointDefinition<unknown>)),
  );
  const endpoints = results.map((result, index) => {
    const check = checks[index]!;
    return toHealthEndpoint(check.label, check.path, check.endpoint.key, result, checkedAt);
  });
  const body: HealthResponse = {
    endpoints,
    checkedAt,
    healthy: endpoints.filter((endpoint) => endpoint.reachable).length,
    total: endpoints.length,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
