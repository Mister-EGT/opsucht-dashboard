import type { HistoryPoint, MarketItem, MarketPricesResponse } from "@/lib/schemas";
import type { HistoryStats, MarketOrderPair, MarketRow } from "@/lib/types";
import { formatMaterialName, parseOpsuchtDate } from "@/lib/format";

export function splitOrderSides(orders: MarketPricesResponse[string][string]): MarketOrderPair {
  const pair: MarketOrderPair = {};
  for (const order of orders) {
    const side = order.orderSide.toUpperCase();
    if (side === "BUY") pair.buy = order;
    if (side === "SELL") pair.sell = order;
  }
  return pair;
}

function usablePrice(order: MarketOrderPair["buy"]): number | null {
  if (!order) return null;
  if (order.price === 0 && order.activeOrders === 0) return null;
  return order.price;
}

export function calculateSpread(
  buyPrice: number | null,
  sellPrice: number | null,
): { spread: number | null; percent: number | null } {
  if (buyPrice === null || sellPrice === null) return { spread: null, percent: null };
  const higher = Math.max(buyPrice, sellPrice);
  const lower = Math.min(buyPrice, sellPrice);
  const spread = higher - lower;
  return {
    spread,
    percent: lower > 0 ? (spread / lower) * 100 : null,
  };
}

export function flattenMarketPrices(
  prices: MarketPricesResponse,
  items: MarketItem[] = [],
): MarketRow[] {
  const iconByMaterial = new Map(items.map((item) => [item.material.toUpperCase(), item.icon]));
  const rows: MarketRow[] = [];
  const includedMaterials = new Set<string>();

  for (const [category, categoryItems] of Object.entries(prices)) {
    for (const [material, orders] of Object.entries(categoryItems)) {
      includedMaterials.add(material.toUpperCase());
      const { buy, sell } = splitOrderSides(orders);
      const buyPrice = usablePrice(buy);
      const sellPrice = usablePrice(sell);
      const { spread, percent } = calculateSpread(buyPrice, sellPrice);
      rows.push({
        material,
        name: formatMaterialName(material),
        category,
        icon: iconByMaterial.get(material.toUpperCase()),
        buyPrice,
        sellPrice,
        buyOrders: buy?.activeOrders ?? 0,
        sellOrders: sell?.activeOrders ?? 0,
        spread,
        spreadPercent: percent,
        complete: Boolean(buy && sell && buyPrice !== null && sellPrice !== null),
      });
    }
  }

  for (const item of items) {
    if (includedMaterials.has(item.material.toUpperCase())) continue;
    rows.push({
      material: item.material,
      name: formatMaterialName(item.material),
      category: "Nicht zugeordnet",
      icon: item.icon,
      buyPrice: null,
      sellPrice: null,
      buyOrders: 0,
      sellOrders: 0,
      spread: null,
      spreadPercent: null,
      complete: false,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function calculateHistoryStats(points: HistoryPoint[]): HistoryStats {
  if (points.length === 0) {
    return { minimum: null, maximum: null, average: null, items: 0, transactions: 0 };
  }
  const valid = points.filter((point) => Number.isFinite(point.avgPrice));
  if (valid.length === 0) {
    return { minimum: null, maximum: null, average: null, items: 0, transactions: 0 };
  }
  return {
    minimum: Math.min(...valid.map((point) => point.minPrice)),
    maximum: Math.max(...valid.map((point) => point.maxPrice)),
    average: valid.reduce((sum, point) => sum + point.avgPrice, 0) / valid.length,
    items: valid.reduce((sum, point) => sum + point.items, 0),
    transactions: valid.reduce((sum, point) => sum + point.transactions, 0),
  };
}

export function sortValidHistoryPoints(points: HistoryPoint[]): HistoryPoint[] {
  return points
    .filter((point) => Number.isFinite(parseOpsuchtDate(point.timestamp).getTime()))
    .sort((a, b) => parseOpsuchtDate(a.timestamp).getTime() - parseOpsuchtDate(b.timestamp).getTime());
}
