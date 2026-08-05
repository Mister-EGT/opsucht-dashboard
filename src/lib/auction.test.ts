import { describe, expect, it } from "vitest";
import { buildAuctionBidPriceHistory } from "@/lib/auction";

describe("Auktionsgebotsverlauf", () => {
  it("beginnt beim Startgebot und sortiert die echten Gebote nach Betrag", () => {
    expect(buildAuctionBidPriceHistory(1_000, {
      "bidder-a": 10_000,
      "bidder-b": 4_000,
      "bidder-c": 7_500,
    })).toEqual([
      { step: 0, label: "Startgebot", price: 1_000 },
      { step: 1, label: "Gebot 1", price: 4_000 },
      { step: 2, label: "Gebot 2", price: 7_500 },
      { step: 3, label: "Gebot 3", price: 10_000 },
    ]);
  });
});
