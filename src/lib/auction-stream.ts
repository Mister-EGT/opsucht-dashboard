import { auctionSchema, type Auction } from "@/lib/schemas";
import type { ApiEnvelope } from "@/lib/types";

export type AuctionStreamChange =
  | { kind: "upsert"; auction: Auction }
  | { kind: "remove"; uid: string }
  | { kind: "reset" };

const UPSERT_EVENTS = new Set([
  "auction.created", "auction.bid_placed", "auction.updated",
]);
const REMOVE_EVENTS = new Set([
  "auction.instant_bought", "auction.sold", "auction.expired",
  "auction.cancelled",
]);

export function parseAuctionStreamChange(type: string, data: string): AuctionStreamChange | null {
  if (type === "stream.reset") return { kind: "reset" };
  if (type === "auction.removed") {
    let value: unknown = data;
    try {
      value = JSON.parse(data);
    } catch {
      // The stream may send the UID directly as plain text.
    }
    const uid = typeof value === "string"
      ? value
      : value && typeof value === "object" && "uid" in value ? value.uid : null;
    return typeof uid === "string" && uid.length > 0 && uid.length <= 128 && !/\s/.test(uid)
      ? { kind: "remove", uid }
      : { kind: "reset" };
  }
  if (!UPSERT_EVENTS.has(type) && !REMOVE_EVENTS.has(type)) return null;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return { kind: "reset" };
  }
  const parsed = auctionSchema.safeParse(value);
  if (!parsed.success) return { kind: "reset" };
  if (REMOVE_EVENTS.has(type)) return { kind: "remove", uid: parsed.data.uid };
  return { kind: "upsert", auction: parsed.data };
}

export function applyAuctionStreamChange(
  current: ApiEnvelope<Auction[]> | undefined,
  change: Exclude<AuctionStreamChange, { kind: "reset" }>,
): ApiEnvelope<Auction[]> | undefined {
  if (!current) return current;
  const previous = current.data;
  const data = change.kind === "remove"
    ? previous.filter((auction) => auction.uid !== change.uid)
    : previous.some((auction) => auction.uid === change.auction.uid)
      ? previous.map((auction) => auction.uid === change.auction.uid ? change.auction : auction)
      : [...previous, change.auction];
  if (data.length === previous.length && change.kind === "remove") return current;
  const now = new Date().toISOString();
  return {
    data,
    meta: current.meta.stale ? current.meta : {
      ...current.meta,
      stale: false,
      source: "live",
      cachedAt: now,
      fetchedAt: now,
      lastSuccessAt: now,
      ageMs: 0,
      error: undefined,
    },
  };
}
