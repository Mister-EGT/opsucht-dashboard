import { describe, expect, it } from "vitest";
import { auctionCategoriesSchema, marketCategoriesSchema, parseAuctions, parseMarketHistory, parseMarketPrices, parseMerchantRates } from "@/lib/schemas";

describe("OPSUCHT-Zod-Parser", () => {
  it("parst eine reale Auktionsform und toleriert zusätzliche Felder", () => {
    const parsed = parseAuctions([
      {
        uid: "a38c1db5cd5fa69fa269e6a2baabbc2b",
        seller: "0072476a-43b2-4fc1-8c77-4e86841f97b2",
        item: {
          material: "GOLDEN_HORSE_ARMOR",
          amount: 1,
          displayName: "Creakinghelm",
          lore: ["", "Gewinntyp » Item"],
          enchantments: { "minecraft:mending": 2 },
          futureItemField: true,
        },
        category: "custom_items",
        startBid: 280000,
        instantBuyPrice: 300000,
        currentBid: 280000,
        bids: {},
        startTime: "2026-07-19T05:59:44.548Z",
        endTime: "2026-07-22T05:59:44.548Z",
        futureAuctionField: "erlaubt",
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.item.enchantments["minecraft:mending"]).toBe(2);
    expect(parsed[0]?.futureAuctionField).toBe("erlaubt");
  });

  it("weist eine Auktionsantwort ohne stabile UID zurück", () => {
    expect(() => parseAuctions([{ item: {}, category: "custom_items" }])).toThrow();
  });

  it("parst Marktpreise unabhängig von der orderSide-Reihenfolge", () => {
    const parsed = parseMarketPrices({
      Holz: {
        ACACIA_LEAVES: [
          { orderSide: "SELL", activeOrders: 9, price: 2.3 },
          { orderSide: "BUY", activeOrders: 145, price: 42.9 },
        ],
      },
    });
    expect(parsed.Holz?.ACACIA_LEAVES?.[0]?.orderSide).toBe("SELL");
  });

  it("ergänzt fehlende Verlaufszeiträume als leere Arrays", () => {
    const parsed = parseMarketHistory({
      HOURLY: [{ timestamp: "2026-07-06T19:00:00", avgPrice: 69, minPrice: 69, maxPrice: 69, items: 1, transactions: 1 }],
    });
    expect(parsed.HOURLY).toHaveLength(1);
    expect(parsed.DAILY).toEqual([]);
    expect(parsed.MONTHLY).toEqual([]);
  });

  it("parst einfache und komplexe Händlerquellen", () => {
    const parsed = parseMerchantRates([
      { source: "diamond_block", target: "opshards", base: 12, exchangeRate: 13.17 },
      { source: "minecraft:paper[custom_name={text: \"Holzbündel\"},custom_model_data={floats: [625.0f]}]", target: "opshards", base: 21, exchangeRate: 21.68 },
    ]);
    expect(parsed).toHaveLength(2);
  });

  it("toleriert fehlende optionale Darstellungsfelder in Kategorien", () => {
    expect(auctionCategoriesSchema.parse([{ name: "blocks", displayName: "Blöcke" }])[0]).toMatchObject({ name: "blocks" });
    expect(marketCategoriesSchema.parse([{ name: "Holz", icon: null }])[0]).toMatchObject({ name: "Holz", icon: null });
  });
});
