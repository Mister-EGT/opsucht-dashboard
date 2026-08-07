"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccount } from "@/components/account-provider";
import { useToast } from "@/components/toast-provider";
import { emptyFavoriteState, favoriteStateToRows, favoriteStorageKey, parseFavoriteState, remoteRowsToFavoriteState, resolveCloudFavoriteState } from "@/lib/favorites-sync";
import { normalizeMaterialKey } from "@/lib/material";
import type { Auction } from "@/lib/schemas";
import type { FavoriteRow } from "@/lib/supabase/database.types";
import type { FavoriteState } from "@/lib/types";

export type FavoriteSyncStatus = "local" | "syncing" | "synced" | "paused" | "error";

interface FavoritesContextValue extends FavoriteState {
  hydrated: boolean;
  syncStatus: FavoriteSyncStatus;
  syncError: string | null;
  cloudBacked: boolean;
  isMarketFavorite: (material: string) => boolean;
  isAuctionFavorite: (id: string) => boolean;
  isMerchantFavorite: (id: string) => boolean;
  toggleMarket: (material: string) => void;
  toggleAuction: (auction: Auction) => void;
  toggleMerchant: (id: string) => void;
  removeAuction: (id: string) => void;
  refreshCloud: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readStoredFavorites(key: string): FavoriteState {
  try {
    return parseFavoriteState(JSON.parse(localStorage.getItem(key) ?? "null"));
  } catch {
    return emptyFavoriteState;
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const { notify } = useToast();
  const [state, setState] = useState<FavoriteState>(emptyFavoriteState);
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<FavoriteSyncStatus>("local");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const userId = account.user?.id ?? null;
  const cloudEnabled = Boolean(
    userId
    && account.supabase
    && account.access?.status === "active"
    && account.settings.cloudFavoritesEnabled,
  );

  const replaceState = useCallback((next: FavoriteState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = account.supabase;
    const initialLoad = window.setTimeout(() => {
      if (!active) return;
      const cacheKey = favoriteStorageKey(userId);
      const cached = readStoredFavorites(cacheKey);
      replaceState(cached);
      setHydrated(false);
      setSyncError(null);

      if (!cloudEnabled || !supabase || !userId) {
        setSyncStatus(userId && account.configured ? "paused" : "local");
        setHydrated(true);
        return;
      }

      setSyncStatus("syncing");
      void (async () => {
        const { data, error } = await supabase
          .from("user_favorites")
          .select("*")
          .eq("user_id", userId);

        if (!active) return;
        if (error) {
          setSyncStatus("error");
          setSyncError("Die Cloud-Favoriten konnten nicht geladen werden. Lokale Änderungen bleiben erhalten.");
          setHydrated(true);
          return;
        }

        const importedKey = `opsucht-favorites-v1-imported-${userId}`;
        let firstImport = true;
        let guestState = emptyFavoriteState;
        try {
          firstImport = localStorage.getItem(importedKey) !== "yes";
          if (firstImport) {
            guestState = readStoredFavorites(favoriteStorageKey(null));
          }
        } catch {
          // A blocked marker only means the harmless merge can happen again later.
        }

        const merged = resolveCloudFavoriteState(
          remoteRowsToFavoriteState((data ?? []) as FavoriteRow[]),
          cached,
          guestState,
          firstImport,
        );
        replaceState(merged);

        const rows = firstImport ? favoriteStateToRows(merged, userId) : [];
        if (rows.length) {
          const { error: upsertError } = await supabase
            .from("user_favorites")
            .upsert(rows, { onConflict: "user_id,kind,entity_id" });
          if (upsertError && active) {
            setSyncStatus("error");
            setSyncError("Ein Teil der lokalen Favoriten konnte nicht hochgeladen werden.");
            setHydrated(true);
            return;
          }
        }

        try {
          localStorage.setItem(importedKey, "yes");
        } catch {
          // Synchronization itself succeeded even if the migration marker cannot be stored.
        }
        if (active) {
          setSyncStatus("synced");
          setHydrated(true);
        }
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(initialLoad);
    };
  }, [account.configured, account.supabase, cloudEnabled, refreshVersion, replaceState, userId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(favoriteStorageKey(userId), JSON.stringify(state));
    } catch {
      // Favorites remain available for the current session if storage is blocked or full.
    }
  }, [hydrated, state, userId]);

  const syncMutation = useCallback(async (
    action: "upsert" | "delete",
    kind: "market" | "merchant" | "auction",
    entityId: string,
    auction?: Auction,
  ) => {
    if (!cloudEnabled || !account.supabase || !userId) return;
    setSyncStatus("syncing");
    let result;
    if (action === "delete") {
      result = await account.supabase.from("user_favorites").delete().eq("user_id", userId).eq("kind", kind).eq("entity_id", entityId);
    } else {
      const row = favoriteStateToRows({
        market: kind === "market" ? [entityId] : [],
        merchant: kind === "merchant" ? [entityId] : [],
        auctions: kind === "auction" && auction ? [{ id: entityId, savedAt: new Date().toISOString(), snapshot: auction }] : [],
      }, userId)[0];
      if (!row) return;
      result = await account.supabase.from("user_favorites").upsert(row, { onConflict: "user_id,kind,entity_id" });
    }

    if (result.error) {
      setSyncStatus("error");
      setSyncError("Die letzte Favoritenänderung konnte noch nicht synchronisiert werden.");
      notify("Favorit lokal gespeichert, Cloud-Synchronisierung fehlgeschlagen.", "danger");
    } else {
      setSyncStatus("synced");
      setSyncError(null);
    }
  }, [account.supabase, cloudEnabled, notify, userId]);

  const toggleMarket = useCallback((material: string) => {
    const normalized = normalizeMaterialKey(material);
    if (!normalized) return;
    const removing = stateRef.current.market.includes(normalized);
    replaceState({
      ...stateRef.current,
      market: removing
        ? stateRef.current.market.filter((item) => item !== normalized)
        : [...stateRef.current.market, normalized],
    });
    void syncMutation(removing ? "delete" : "upsert", "market", normalized);
  }, [replaceState, syncMutation]);

  const toggleMerchant = useCallback((id: string) => {
    const normalized = id.trim();
    if (!normalized) return;
    const removing = stateRef.current.merchant.includes(normalized);
    replaceState({
      ...stateRef.current,
      merchant: removing
        ? stateRef.current.merchant.filter((item) => item !== normalized)
        : [...stateRef.current.merchant, normalized],
    });
    void syncMutation(removing ? "delete" : "upsert", "merchant", normalized);
  }, [replaceState, syncMutation]);

  const toggleAuction = useCallback((auction: Auction) => {
    const removing = stateRef.current.auctions.some((favorite) => favorite.id === auction.uid);
    replaceState({
      ...stateRef.current,
      auctions: removing
        ? stateRef.current.auctions.filter((favorite) => favorite.id !== auction.uid)
        : [...stateRef.current.auctions, { id: auction.uid, savedAt: new Date().toISOString(), snapshot: auction }],
    });
    void syncMutation(removing ? "delete" : "upsert", "auction", auction.uid, auction);
  }, [replaceState, syncMutation]);

  const removeAuction = useCallback((id: string) => {
    replaceState({
      ...stateRef.current,
      auctions: stateRef.current.auctions.filter((favorite) => favorite.id !== id),
    });
    void syncMutation("delete", "auction", id);
  }, [replaceState, syncMutation]);

  const value = useMemo<FavoritesContextValue>(() => ({
    ...state,
    hydrated,
    syncStatus,
    syncError,
    cloudBacked: cloudEnabled,
    isMarketFavorite: (material) => state.market.includes(normalizeMaterialKey(material)),
    isAuctionFavorite: (id) => state.auctions.some((favorite) => favorite.id === id),
    isMerchantFavorite: (id) => state.merchant.includes(id),
    toggleMarket,
    toggleAuction,
    toggleMerchant,
    removeAuction,
    refreshCloud: () => setRefreshVersion((value) => value + 1),
  }), [cloudEnabled, hydrated, removeAuction, state, syncError, syncStatus, toggleAuction, toggleMarket, toggleMerchant]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites muss innerhalb des FavoritesProvider verwendet werden.");
  return context;
}
