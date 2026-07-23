"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auctionSchema, type Auction } from "@/lib/schemas";
import type { AuctionFavorite, FavoriteState } from "@/lib/types";
import { normalizeMaterialKey, normalizeMaterialList } from "@/lib/material";

const STORAGE_KEY = "opsucht-favorites-v1";
const emptyState: FavoriteState = { market: [], auctions: [], merchant: [] };

interface FavoritesContextValue extends FavoriteState {
  hydrated: boolean;
  isMarketFavorite: (material: string) => boolean;
  isAuctionFavorite: (id: string) => boolean;
  isMerchantFavorite: (id: string) => boolean;
  toggleMarket: (material: string) => void;
  toggleAuction: (auction: Auction) => void;
  toggleMerchant: (id: string) => void;
  removeAuction: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readStoredFavorites(): FavoriteState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<FavoriteState> | null;
    if (!parsed) return emptyState;
    return {
      market: normalizeMaterialList(parsed.market),
      merchant: Array.isArray(parsed.merchant) ? [...new Set(parsed.merchant.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))].slice(0, 500) : [],
      auctions: Array.isArray(parsed.auctions)
        ? parsed.auctions.flatMap((value): AuctionFavorite[] => {
            if (!value || typeof value !== "object" || !("id" in value) || !("snapshot" in value)) return [];
            const candidate = value as Partial<AuctionFavorite>;
            const snapshot = auctionSchema.safeParse(candidate.snapshot);
            if (typeof candidate.id !== "string" || !snapshot.success) return [];
            return [{ id: candidate.id, savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(), snapshot: snapshot.data }];
          }).filter((favorite, index, all) => all.findIndex((candidate) => candidate.id === favorite.id) === index).slice(0, 250)
        : [],
    };
  } catch {
    return emptyState;
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FavoriteState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(readStoredFavorites());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Favorites remain available for the current session if storage is blocked or full.
    }
  }, [state, hydrated]);

  const toggleMarket = useCallback((material: string) => {
    const normalized = normalizeMaterialKey(material);
    if (!normalized) return;
    setState((current) => ({
      ...current,
      market: current.market.includes(normalized)
        ? current.market.filter((item) => item !== normalized)
        : [...current.market, normalized],
    }));
  }, []);

  const toggleMerchant = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      merchant: current.merchant.includes(id)
        ? current.merchant.filter((item) => item !== id)
        : [...current.merchant, id],
    }));
  }, []);

  const toggleAuction = useCallback((auction: Auction) => {
    setState((current) => {
      const exists = current.auctions.some((favorite) => favorite.id === auction.uid);
      return {
        ...current,
        auctions: exists
          ? current.auctions.filter((favorite) => favorite.id !== auction.uid)
          : [...current.auctions, { id: auction.uid, savedAt: new Date().toISOString(), snapshot: auction }],
      };
    });
  }, []);

  const removeAuction = useCallback((id: string) => {
    setState((current) => ({ ...current, auctions: current.auctions.filter((favorite) => favorite.id !== id) }));
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ...state,
      hydrated,
      isMarketFavorite: (material) => state.market.includes(normalizeMaterialKey(material)),
      isAuctionFavorite: (id) => state.auctions.some((favorite) => favorite.id === id),
      isMerchantFavorite: (id) => state.merchant.includes(id),
      toggleMarket,
      toggleAuction,
      toggleMerchant,
      removeAuction,
    }),
    [state, hydrated, toggleMarket, toggleAuction, toggleMerchant, removeAuction],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites muss innerhalb des FavoritesProvider verwendet werden.");
  return context;
}
