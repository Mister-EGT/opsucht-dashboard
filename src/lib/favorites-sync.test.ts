import { describe, expect, it } from "vitest";
import { favoriteStateToRows, favoriteStorageKey, mergeFavoriteStates, remoteRowsToFavoriteState, resolveCloudFavoriteState } from "@/lib/favorites-sync";
import type { FavoriteRow } from "@/lib/supabase/database.types";
import { auctionSchema } from "@/lib/schemas";

const auction = auctionSchema.parse({
  uid: "auction-1",
  seller: "00000000-0000-0000-0000-000000000001",
  startTime: "2026-08-07T10:00:00+02:00",
  endTime: "2026-08-08T10:00:00+02:00",
  category: "custom_items",
  startBid: 100,
  currentBid: 125,
  item: { material: "DIAMOND", amount: 1 },
  bids: {},
});

describe("Favoriten-Synchronisierung", () => {
  it("trennt Gast- und Benutzer-Cache", () => {
    expect(favoriteStorageKey(null)).toBe("opsucht-favorites-v1");
    expect(favoriteStorageKey("user-1")).toContain("user-1");
  });

  it("vereinigt lokale und entfernte Favoriten ohne Duplikate", () => {
    const result = mergeFavoriteStates(
      { market: ["diamond"], merchant: ["rate-1"], auctions: [] },
      { market: ["DIAMOND", "EMERALD"], merchant: [], auctions: [{ id: auction.uid, savedAt: "2026-08-07T08:00:00Z", snapshot: auction }] },
    );
    expect(result.market).toEqual(["DIAMOND", "EMERALD"]);
    expect(result.merchant).toEqual(["rate-1"]);
    expect(result.auctions).toHaveLength(1);
  });

  it("ignoriert beschädigte Auktions-Snapshots aus der Cloud", () => {
    const rows = [{
      id: "00000000-0000-0000-0000-000000000002",
      user_id: "00000000-0000-0000-0000-000000000003",
      kind: "auction",
      entity_id: "broken",
      snapshot: { invalid: true },
      saved_at: "2026-08-07T08:00:00Z",
      updated_at: "2026-08-07T08:00:00Z",
    }] satisfies FavoriteRow[];
    expect(remoteRowsToFavoriteState(rows).auctions).toEqual([]);
  });

  it("lässt einen alten Gerätecache keine Cloud-Löschungen rückgängig machen", () => {
    const staleCache = { market: ["DIAMOND"], merchant: [], auctions: [] };
    expect(resolveCloudFavoriteState({ market: [], merchant: [], auctions: [] }, staleCache, staleCache, false).market).toEqual([]);
    expect(resolveCloudFavoriteState({ market: [], merchant: [], auctions: [] }, staleCache, staleCache, true).market).toEqual(["DIAMOND"]);
  });

  it("erzeugt begrenzte, typisierte Upsert-Zeilen", () => {
    const rows = favoriteStateToRows({ market: ["diamond"], merchant: [], auctions: [] }, "user-1");
    expect(rows).toEqual([{ user_id: "user-1", kind: "market", entity_id: "DIAMOND", snapshot: null }]);
  });
});
