import type {
  Auction,
  HistoryPoint,
  MarketOrder,
  MerchantRate,
} from "@/lib/schemas";

export type ApiSource = "live" | "cache";

export interface ApiMeta {
  key: string;
  source: ApiSource;
  stale: boolean;
  cachedAt: string;
  fetchedAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  responseTimeMs: number;
  upstreamStatus: number;
  ageMs: number;
  ttlMs: number;
  error?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta?: Partial<ApiMeta>;
}

export interface MarketRow {
  material: string;
  name: string;
  category: string;
  icon?: string | null;
  buyPrice: number | null;
  sellPrice: number | null;
  buyOrders: number;
  sellOrders: number;
  spread: number | null;
  spreadPercent: number | null;
  complete: boolean;
}

export interface ParsedMerchantRate extends MerchantRate {
  id: string;
  material: string;
  materialKey: string;
  displayName: string;
  customName: string | null;
  customModelData: number | null;
  isCustom: boolean;
  deviation: number;
  deviationPercent: number | null;
  rawSource: string;
}

export interface HistoryStats {
  minimum: number | null;
  maximum: number | null;
  average: number | null;
  items: number;
  transactions: number;
}

export type HistoryPeriod = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";
export type HistoryMetric = "avgPrice" | "minPrice" | "maxPrice" | "items" | "transactions";

export interface AuctionFavorite {
  id: string;
  savedAt: string;
  snapshot: Auction;
}

export interface FavoriteState {
  market: string[];
  auctions: AuctionFavorite[];
  merchant: string[];
}

export interface CalculatorPosition {
  id: string;
  material: string;
  quantity: number;
}

export interface HealthEndpoint {
  key: string;
  label: string;
  path: string;
  reachable: boolean;
  status: number;
  responseTimeMs: number;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  cacheStatus: ApiSource | "none";
  stale: boolean;
  dataAgeMs: number | null;
  checkedAt: string;
  message: string;
}

export interface HealthResponse {
  endpoints: HealthEndpoint[];
  checkedAt: string;
  healthy: number;
  total: number;
}

export type MarketOrderPair = {
  buy?: MarketOrder;
  sell?: MarketOrder;
};

export type MarketMovement = MarketRow & {
  previous: HistoryPoint;
  current: HistoryPoint;
  absoluteChange: number;
  percentChange: number | null;
};
