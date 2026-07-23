import { describe, expect, it } from "vitest";
import { buildCalculatorOptions, calculateCalculatorTotals } from "@/lib/calculator";
import type { MarketRow, ParsedMerchantRate } from "@/lib/types";

describe("Vergleichsrechner", () => {
  it("bietet dasselbe Standardmaterial aus Markt und Händler nicht doppelt an", () => {
    const market = [{ material: "DIAMOND_BLOCK", name: "Diamantblock", category: "Blöcke", buyPrice: 1, sellPrice: 1, buyOrders: 1, sellOrders: 1, spread: 0, spreadPercent: 0, complete: true }] satisfies MarketRow[];
    const merchant = [{ materialKey: "diamond_block", displayName: "Diamantblock", material: "diamond_block" }] as ParsedMerchantRate[];
    expect(buildCalculatorOptions(market, merchant)).toHaveLength(1);
  });

  it("berechnet die Differenz nur aus tatsächlich vergleichbaren Positionen", () => {
    const totals = calculateCalculatorTotals([
      { marketBuy: 100, marketSell: 80, merchantValue: null },
      { marketBuy: 50, marketSell: null, merchantValue: 12 },
      { marketBuy: null, marketSell: null, merchantValue: null },
    ]);
    expect(totals.marketBuy).toBe(150);
    expect(totals.comparableDifference).toBe(20);
    expect(totals.comparableCount).toBe(1);
    expect(totals.availableMerchant).toBe(1);
  });
});
