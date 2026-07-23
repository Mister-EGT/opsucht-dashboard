import { describe, expect, it } from "vitest";
import { calculateHistoryStats, calculateSpread, flattenMarketPrices, sortValidHistoryPoints, splitOrderSides } from "@/lib/market";

describe("Marktberechnungen", () => {
  it("ordnet BUY und SELL anhand des Feldes statt der Position zu", () => {
    const pair = splitOrderSides([
      { orderSide: "SELL", activeOrders: 11, price: 3.8 },
      { orderSide: "BUY", activeOrders: 62, price: 49.5 },
    ]);
    expect(pair.buy?.price).toBe(49.5);
    expect(pair.sell?.price).toBe(3.8);
  });

  it("entfernt ungültige Verlaufstimestamps vor der Sortierung", () => {
    const point = { avgPrice: 1, minPrice: 1, maxPrice: 1, items: 1, transactions: 1 };
    const sorted = sortValidHistoryPoints([
      { ...point, timestamp: "kein-zeitstempel" },
      { ...point, timestamp: "2026-07-06T20:00:00" },
      { ...point, timestamp: "2026-07-06T19:00:00" },
    ]);
    expect(sorted.map((item) => item.timestamp)).toEqual(["2026-07-06T19:00:00", "2026-07-06T20:00:00"]);
  });

  it("berechnet absoluten und relativen Spread auf Basis des niedrigeren Kurses", () => {
    const result = calculateSpread(49.5, 3.8);
    expect(result.spread).toBeCloseTo(45.7);
    expect(result.percent).toBeCloseTo((45.7 / 3.8) * 100);
  });

  it("behandelt 0 ohne aktive Aufträge als fehlenden Kurs", () => {
    const rows = flattenMarketPrices({
      Holz: {
        AZALEA: [
          { orderSide: "BUY", activeOrders: 134, price: 3.6 },
          { orderSide: "SELL", activeOrders: 0, price: 0 },
        ],
      },
    });
    expect(rows[0]?.buyPrice).toBe(3.6);
    expect(rows[0]?.sellPrice).toBeNull();
    expect(rows[0]?.spread).toBeNull();
    expect(rows[0]?.complete).toBe(false);
  });

  it("behält Marktitems ohne eigenen Preisdatensatz als unvollständige Zeile bei", () => {
    const rows = flattenMarketPrices(
      { Erze: { DIAMOND: [{ orderSide: "BUY", activeOrders: 2, price: 100 }] } },
      [
        { material: "DIAMOND", icon: "https://example.com/diamond.png" },
        { material: "EMERALD", icon: "https://example.com/emerald.png" },
      ],
    );
    const orphan = rows.find((row) => row.material === "EMERALD");
    expect(rows).toHaveLength(2);
    expect(orphan).toMatchObject({
      category: "Nicht zugeordnet",
      buyPrice: null,
      sellPrice: null,
      buyOrders: 0,
      sellOrders: 0,
      complete: false,
    });
  });

  it("aggregiert Verlaufsstatistiken ohne fehlende Werte zu erfinden", () => {
    const stats = calculateHistoryStats([
      { timestamp: "2026-07-01T00:00:00", avgPrice: 10, minPrice: 8, maxPrice: 12, items: 5, transactions: 2 },
      { timestamp: "2026-07-02T00:00:00", avgPrice: 20, minPrice: 14, maxPrice: 24, items: 7, transactions: 3 },
    ]);
    expect(stats).toEqual({ minimum: 8, maximum: 24, average: 15, items: 12, transactions: 5 });
    expect(calculateHistoryStats([]).average).toBeNull();
  });
});
