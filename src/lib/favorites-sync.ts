import { auctionSchema } from "@/lib/schemas";
import { normalizeMaterialList } from "@/lib/material";
import type { Database, FavoriteRow, Json } from "@/lib/supabase/database.types";
import type { AuctionFavorite, FavoriteState } from "@/lib/types";

export const emptyFavoriteState: FavoriteState = { market: [], auctions: [], merchant: [] };

export function favoriteOwnerKey(userId: string | null): string {
  return userId ?? "guest";
}

export function canPersistFavoriteState(
  hydrated: boolean,
  stateOwnerKey: string | null,
  userId: string | null,
): boolean {
  return hydrated && stateOwnerKey === favoriteOwnerKey(userId);
}

function uniqueStrings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))]
    .slice(0, limit);
}

export function parseFavoriteState(value: unknown): FavoriteState {
  if (!value || typeof value !== "object") return emptyFavoriteState;
  const candidate = value as Partial<FavoriteState>;
  const auctions = Array.isArray(candidate.auctions)
    ? candidate.auctions.flatMap((item): AuctionFavorite[] => {
        if (!item || typeof item !== "object") return [];
        const favorite = item as Partial<AuctionFavorite>;
        const snapshot = auctionSchema.safeParse(favorite.snapshot);
        if (typeof favorite.id !== "string" || !snapshot.success) return [];
        return [{
          id: favorite.id,
          savedAt: typeof favorite.savedAt === "string" ? favorite.savedAt : new Date(0).toISOString(),
          snapshot: snapshot.data,
        }];
      })
    : [];

  return {
    market: normalizeMaterialList(candidate.market),
    merchant: uniqueStrings(candidate.merchant, 500),
    auctions: auctions
      .filter((favorite, index, all) => all.findIndex((item) => item.id === favorite.id) === index)
      .slice(0, 250),
  };
}

export function remoteRowsToFavoriteState(rows: FavoriteRow[]): FavoriteState {
  return parseFavoriteState({
    market: rows.filter((row) => row.kind === "market").map((row) => row.entity_id),
    merchant: rows.filter((row) => row.kind === "merchant").map((row) => row.entity_id),
    auctions: rows
      .filter((row) => row.kind === "auction")
      .map((row) => ({ id: row.entity_id, savedAt: row.saved_at, snapshot: row.snapshot })),
  });
}

export function mergeFavoriteStates(...states: FavoriteState[]): FavoriteState {
  const parsed = states.map(parseFavoriteState);
  const auctionMap = new Map<string, AuctionFavorite>();
  parsed.flatMap((state) => state.auctions).forEach((favorite) => {
    const current = auctionMap.get(favorite.id);
    if (!current || Date.parse(favorite.savedAt) >= Date.parse(current.savedAt)) {
      auctionMap.set(favorite.id, favorite);
    }
  });

  return parseFavoriteState({
    market: parsed.flatMap((state) => state.market),
    merchant: parsed.flatMap((state) => state.merchant),
    auctions: [...auctionMap.values()],
  });
}

export function resolveCloudFavoriteState(
  remote: FavoriteState,
  cached: FavoriteState,
  guest: FavoriteState,
  firstImport: boolean,
): FavoriteState {
  return firstImport ? mergeFavoriteStates(remote, cached, guest) : parseFavoriteState(remote);
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function favoriteStateToRows(
  state: FavoriteState,
  userId: string,
): Database["public"]["Tables"]["user_favorites"]["Insert"][] {
  const normalized = parseFavoriteState(state);
  return [
    ...normalized.market.map((entityId) => ({
      user_id: userId,
      kind: "market" as const,
      entity_id: entityId,
      snapshot: null,
    })),
    ...normalized.merchant.map((entityId) => ({
      user_id: userId,
      kind: "merchant" as const,
      entity_id: entityId,
      snapshot: null,
    })),
    ...normalized.auctions.map((favorite) => ({
      user_id: userId,
      kind: "auction" as const,
      entity_id: favorite.id,
      saved_at: favorite.savedAt,
      snapshot: toJson(favorite.snapshot),
    })),
  ];
}

export function favoriteStorageKey(userId: string | null): string {
  return userId ? `opsucht-favorites-v1-user-${userId}` : "opsucht-favorites-v1";
}
