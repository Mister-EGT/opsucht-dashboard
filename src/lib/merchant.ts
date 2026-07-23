import type { MerchantRate } from "@/lib/schemas";
import type { ParsedMerchantRate } from "@/lib/types";
import { formatMaterialName } from "@/lib/format";

const customModelPattern = /custom_model_data=(?:\{[^}]*?\[\s*(\d+)(?:\.\d+)?f?|(\d+))/i;
const displayNamePattern = /text:\s*"([^"]+)"/g;

export function parseMerchantSource(source: string): Pick<
  ParsedMerchantRate,
  "material" | "materialKey" | "displayName" | "customName" | "customModelData" | "isCustom" | "rawSource"
> {
  const rawSource = source.trim();
  const bracketIndex = rawSource.indexOf("[");
  const rawMaterial = bracketIndex >= 0 ? rawSource.slice(0, bracketIndex) : rawSource;
  const material = rawMaterial.replace(/^minecraft:/i, "").toLowerCase().replaceAll(" ", "_");
  const isCustom = bracketIndex >= 0;
  const modelMatch = rawSource.match(customModelPattern);
  const customModelData = modelMatch ? Number(modelMatch[1] ?? modelMatch[2]) : null;

  let customName: string | null = null;
  if (isCustom) {
    for (const match of rawSource.matchAll(displayNamePattern)) {
      const candidate = match[1]?.trim();
      if (candidate) {
        customName = candidate;
        break;
      }
    }
  }

  return {
    material,
    materialKey: customModelData === null ? material : `${material}#${customModelData}`,
    displayName: customName ?? formatMaterialName(material),
    customName,
    customModelData,
    isCustom,
    rawSource,
  };
}

export function normalizeMerchantRates(rates: MerchantRate[]): ParsedMerchantRate[] {
  return rates.map((rate) => {
    const source = parseMerchantSource(rate.source);
    const deviation = rate.exchangeRate - rate.base;
    return {
      ...rate,
      ...source,
      id: source.materialKey,
      deviation,
      deviationPercent: rate.base > 0 ? (deviation / rate.base) * 100 : null,
    };
  });
}

export function calculateShardValue(quantity: number, exchangeRate: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(exchangeRate) || quantity < 0 || exchangeRate < 0) return 0;
  return quantity * exchangeRate;
}

export function normalizeWholeItemQuantity(value: number | string): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric));
}

export function calculateRequiredItems(shards: number, exchangeRate: number): {
  exact: number | null;
  wholeItems: number | null;
} {
  if (!Number.isFinite(shards) || !Number.isFinite(exchangeRate) || shards < 0 || exchangeRate <= 0) {
    return { exact: null, wholeItems: null };
  }
  const exact = shards / exchangeRate;
  return { exact, wholeItems: Math.ceil(exact) };
}
