"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi, fetchHealth } from "@/lib/api-client";
import type {
  Auction,
  AuctionCategory,
  MarketCategory,
  MarketHistoryResponse,
  MarketItem,
  MarketPriceResponse,
  MarketPricesResponse,
  MerchantRate,
} from "@/lib/schemas";
import type { HealthResponse } from "@/lib/types";
import type { MinecraftPlayerProfile } from "@/lib/minecraft-player";

export function useAuctions(category?: string, enabled = true) {
  const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
  return useQuery({
    queryKey: ["auctions", category ?? "all"],
    queryFn: ({ signal }) => fetchApi<Auction[]>(`/api/opsucht/auctions${suffix}`, signal),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled,
  });
}

export function useAuctionCategories(enabled = true) {
  return useQuery({
    queryKey: ["auction-categories"],
    queryFn: ({ signal }) => fetchApi<AuctionCategory[]>("/api/opsucht/auction-categories", signal),
    staleTime: 30 * 60_000,
    enabled,
  });
}

export function useMinecraftPlayer(uuid?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["minecraft-player", uuid ?? "none"],
    queryFn: ({ signal }) => {
      if (!uuid) throw new Error("Keine Minecraft-UUID vorhanden.");
      return fetchHealth<MinecraftPlayerProfile>(
        `/api/minecraft/player/${encodeURIComponent(uuid)}`,
        signal,
      );
    },
    staleTime: 12 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(uuid),
  });
}

export function useMarketCategories(enabled = true) {
  return useQuery({
    queryKey: ["market-categories"],
    queryFn: ({ signal }) => fetchApi<MarketCategory[]>("/api/opsucht/market/categories", signal),
    staleTime: 30 * 60_000,
    enabled,
  });
}

export function useMarketItems(enabled = true) {
  return useQuery({
    queryKey: ["market-items"],
    queryFn: ({ signal }) => fetchApi<MarketItem[]>("/api/opsucht/market/items", signal),
    staleTime: 30 * 60_000,
    enabled,
  });
}

export function useMarketPrices(enabled = true) {
  return useQuery({
    queryKey: ["market-prices"],
    queryFn: ({ signal }) => fetchApi<MarketPricesResponse>("/api/opsucht/market/prices", signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useMarketPrice(material: string, enabled = true) {
  return useQuery({
    queryKey: ["market-price", material],
    queryFn: ({ signal }) =>
      fetchApi<MarketPriceResponse>(`/api/opsucht/market/price/${encodeURIComponent(material)}`, signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: enabled && Boolean(material),
  });
}

export function useMarketHistory(material: string, enabled = true) {
  return useQuery({
    queryKey: ["market-history", material],
    queryFn: ({ signal }) =>
      fetchApi<MarketHistoryResponse>(`/api/opsucht/market/history/${encodeURIComponent(material)}`, signal),
    staleTime: 5 * 60_000,
    enabled: enabled && Boolean(material),
  });
}

export function useMerchantRates(enabled = true) {
  return useQuery({
    queryKey: ["merchant-rates"],
    queryFn: ({ signal }) => fetchApi<MerchantRate[]>("/api/opsucht/merchant/rates", signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useApiHealth(enabled = true) {
  return useQuery({
    queryKey: ["api-health"],
    queryFn: ({ signal }) => fetchHealth<HealthResponse>("/api/opsucht/health", signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
    enabled,
  });
}
