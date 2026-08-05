import type { MarketRow, ParsedMerchantRate } from "@/lib/types";
import type { MerchantCurrency } from "@/lib/schemas";
import { normalizeMaterialKey } from "@/lib/material";
import { merchantCurrencyLabel } from "@/lib/merchant";

export interface CalculatorOption {
  key: string;
  label: string;
  source: "market" | "merchant";
}

export interface CalculatorValueSet {
  marketBuy: number | null;
  marketSell: number | null;
  merchantValue: number | null;
  merchantCurrency: MerchantCurrency | null;
}

export function buildCalculatorOptions(marketRows: MarketRow[], merchantRows: ParsedMerchantRate[]): CalculatorOption[] {
  const map = new Map<string, CalculatorOption>();
  marketRows.forEach((row) => map.set(normalizeMaterialKey(row.material), { key: row.material, label: `${row.name} · Markt`, source: "market" }));
  merchantRows.forEach((rate) => {
    const normalized = normalizeMaterialKey(rate.materialKey);
    if (!map.has(normalized)) map.set(normalized, { key: rate.materialKey, label: `${rate.displayName} · ${merchantCurrencyLabel(rate.target)}`, source: "merchant" });
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "de"));
}

export function calculateCalculatorTotals(positions: CalculatorValueSet[]) {
  return positions.reduce((current, position) => {
    const comparable = position.marketBuy !== null && position.marketSell !== null;
    const merchant = { ...current.merchant };
    const availableMerchant = { ...current.availableMerchant };
    if (position.merchantValue !== null && position.merchantCurrency !== null) {
      merchant[position.merchantCurrency] += position.merchantValue;
      availableMerchant[position.merchantCurrency] += 1;
    }
    return {
      marketBuy: current.marketBuy + (position.marketBuy ?? 0),
      marketSell: current.marketSell + (position.marketSell ?? 0),
      merchant,
      availableBuy: current.availableBuy + (position.marketBuy === null ? 0 : 1),
      availableSell: current.availableSell + (position.marketSell === null ? 0 : 1),
      availableMerchant,
      comparableDifference: current.comparableDifference + (comparable ? position.marketBuy! - position.marketSell! : 0),
      comparableCount: current.comparableCount + (comparable ? 1 : 0),
    };
  }, {
    marketBuy: 0,
    marketSell: 0,
    merchant: { opshards: 0, redcoins: 0 } satisfies Record<MerchantCurrency, number>,
    availableBuy: 0,
    availableSell: 0,
    availableMerchant: { opshards: 0, redcoins: 0 } satisfies Record<MerchantCurrency, number>,
    comparableDifference: 0,
    comparableCount: 0,
  });
}
