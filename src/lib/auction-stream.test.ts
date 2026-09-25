import { describe, expect, it } from "vitest";
import { applyAuctionStreamChange, parseAuctionStreamChange } from "@/lib/auction-stream";
import type { Auction } from "@/lib/schemas";
import type { ApiEnvelope } from "@/lib/types";

const auction = {
  uid: "auction-1", category: "custom_items",
  item: { material: "GOLDEN_HORSE_ARMOR", amount: 1, displayName: "Thanos Handschuh", icon: "https://api.opsucht.net/icons/thanos.png" },
  startBid: 100, currentBid: 100, bids: {},
  startTime: "2026-09-25T09:00:00Z", endTime: "2026-09-25T12:00:00Z",
};

const snapshot: ApiEnvelope<Auction[]> = {
  data: [],
  meta: {
    key: "auctions", source: "cache", stale: true,
    cachedAt: "2026-09-25T08:00:00Z", fetchedAt: "2026-09-25T08:00:00Z",
    lastSuccessAt: null, lastErrorAt: null, responseTimeMs: 4,
    upstreamStatus: 200, ageMs: 3_600_000, ttlMs: 30_000,
  },
};

describe("Auktions-Live-Events", () => {
  it("übernimmt vollständige Auktionen und aktualisiert Gebote samt API-Icon", () => {
    const created = parseAuctionStreamChange("auction.created", JSON.stringify(auction));
    expect(created?.kind).toBe("upsert");
    if (!created || created.kind !== "upsert") return;
    const afterCreate = applyAuctionStreamChange(snapshot, created);
    expect(afterCreate?.data[0]?.item.icon).toBe(auction.item.icon);
    const bid = parseAuctionStreamChange("auction.bid_placed", JSON.stringify({ ...auction, currentBid: 250, bids: { bidder: 250 } }));
    if (!bid || bid.kind !== "upsert") throw new Error("Gebot fehlt");
    const updated = applyAuctionStreamChange(afterCreate, bid);
    expect(updated?.data).toHaveLength(1);
    expect(updated?.data[0]?.currentBid).toBe(250);
    expect(updated?.meta.stale).toBe(false);
  });

  it("entfernt abgeschlossene Auktionen und toleriert ein zweites Entfernen", () => {
    const created = parseAuctionStreamChange("auction.created", JSON.stringify(auction));
    if (!created || created.kind !== "upsert") throw new Error("Auktion fehlt");
    const current = applyAuctionStreamChange(snapshot, created);
    const sold = parseAuctionStreamChange("auction.sold", JSON.stringify(auction));
    if (!sold || sold.kind !== "remove") throw new Error("Abschluss fehlt");
    const removed = applyAuctionStreamChange(current, sold);
    expect(removed?.data).toEqual([]);
    const duplicate = parseAuctionStreamChange("auction.removed", JSON.stringify({ uid: auction.uid }));
    if (!duplicate || duplicate.kind !== "remove") throw new Error("UID fehlt");
    expect(applyAuctionStreamChange(removed, duplicate)).toBe(removed);
    expect(parseAuctionStreamChange("auction.removed", auction.uid)).toEqual(duplicate);
  });

  it("fordert bei Stream-Reset oder unbrauchbaren Daten eine neue Momentaufnahme an", () => {
    expect(parseAuctionStreamChange("stream.reset", "")).toEqual({ kind: "reset" });
    expect(parseAuctionStreamChange("auction.created", '{"uid":"missing-item"}')).toEqual({ kind: "reset" });
    expect(parseAuctionStreamChange("auction.removed", "")).toEqual({ kind: "reset" });
    expect(parseAuctionStreamChange("unknown", "{}")).toBeNull();
  });
});
