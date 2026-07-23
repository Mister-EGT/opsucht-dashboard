export type MarketAvailability = "all" | "tradable" | "incomplete";
export type MarketDensity = "compact" | "detailed";

export interface MarketFilterState {
  query: string;
  category: string;
  availability: MarketAvailability;
  density: MarketDensity;
}

export type AuctionViewMode = "table" | "cards";

export interface AuctionFilterState {
  query: string;
  category: string;
  minimum: string;
  maximum: string;
  soon: boolean;
  view: AuctionViewMode;
}

function paramsFrom(value: string): URLSearchParams {
  return new URLSearchParams(value);
}

export function parseMarketFilters(value: string): MarketFilterState {
  const params = paramsFrom(value);
  const filter = params.get("filter");
  return {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "",
    availability: filter === "tradable" || filter === "incomplete" ? filter : "all",
    density: params.get("view") === "compact" ? "compact" : "detailed",
  };
}

export function marketFilterHref(filters: MarketFilterState): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.availability !== "all") params.set("filter", filters.availability);
  if (filters.density === "compact") params.set("view", filters.density);
  return `/market${params.size ? `?${params}` : ""}`;
}

export function parseAuctionFilters(value: string): AuctionFilterState {
  const params = paramsFrom(value);
  return {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "",
    minimum: params.get("min") ?? "",
    maximum: params.get("max") ?? "",
    soon: params.get("soon") === "1",
    view: params.get("view") === "cards" ? "cards" : "table",
  };
}

export function auctionFilterHref(filters: AuctionFilterState): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.minimum) params.set("min", filters.minimum);
  if (filters.maximum) params.set("max", filters.maximum);
  if (filters.soon) params.set("soon", "1");
  if (filters.view === "cards") params.set("view", filters.view);
  return `/auctions${params.size ? `?${params}` : ""}`;
}

export function parseMerchantQuery(value: string): string {
  return paramsFrom(value).get("q") ?? "";
}

export function merchantFilterHref(query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  return `/merchant${params.size ? `?${params}` : ""}`;
}
