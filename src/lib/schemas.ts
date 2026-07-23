import { z } from "zod";

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();

export const auctionItemSchema = z
  .object({
    material: z.string().min(1),
    icon: z.string().url().nullable().optional(),
    amount: z.number().int().positive(),
    displayName: z.string().nullable().optional(),
    lore: z.array(z.string()).optional().default([]),
    enchantments: z.record(z.string(), finiteNumber).optional().default({}),
  })
  .passthrough();

export const auctionSchema = z
  .object({
    uid: z.string().min(1),
    seller: z.string().min(1).optional(),
    item: auctionItemSchema,
    category: z.string().min(1),
    startBid: nonNegativeNumber,
    currentBid: nonNegativeNumber,
    instantBuyPrice: nonNegativeNumber.nullable().optional(),
    highestBidder: z.string().min(1).optional(),
    bids: z.record(z.string(), nonNegativeNumber).optional().default({}),
    startTime: z.iso.datetime({ offset: true }),
    endTime: z.iso.datetime({ offset: true }),
  })
  .passthrough();

export const auctionsSchema = z.array(auctionSchema);

export const auctionCategorySchema = z
  .object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    displayMaterial: z.string().min(1).optional(),
    icon: z.string().url().nullable().optional(),
    parentCategory: z.string().min(1).optional(),
    matchTypes: z.array(z.string()).default([]),
  })
  .passthrough();

export const auctionCategoriesSchema = z.array(auctionCategorySchema);

export const marketCategorySchema = z
  .object({
    name: z.string().min(1),
    material: z.string().min(1).optional(),
    icon: z.string().url().nullable().optional(),
  })
  .passthrough();

export const marketCategoriesSchema = z.array(marketCategorySchema);

export const marketItemSchema = z
  .object({
    material: z.string().min(1),
    icon: z.string().url().nullable().optional(),
  })
  .passthrough();

export const marketItemsSchema = z.array(marketItemSchema);

export const marketOrderSchema = z
  .object({
    orderSide: z.string().min(1),
    activeOrders: nonNegativeInteger,
    price: nonNegativeNumber,
  })
  .passthrough();

export const marketPriceSchema = z.record(
  z.string(),
  z.array(marketOrderSchema),
);

export const marketPricesSchema = z.record(
  z.string(),
  z.record(z.string(), z.array(marketOrderSchema)),
);

export const historyPointSchema = z
  .object({
    timestamp: z.string().min(1),
    avgPrice: nonNegativeNumber,
    minPrice: nonNegativeNumber,
    maxPrice: nonNegativeNumber,
    items: nonNegativeInteger,
    transactions: nonNegativeInteger,
  })
  .passthrough();

export const marketHistorySchema = z
  .object({
    HOURLY: z.array(historyPointSchema).optional().default([]),
    DAILY: z.array(historyPointSchema).optional().default([]),
    WEEKLY: z.array(historyPointSchema).optional().default([]),
    MONTHLY: z.array(historyPointSchema).optional().default([]),
  })
  .passthrough();

export const merchantRateSchema = z
  .object({
    source: z.string().min(1),
    target: z.string().min(1),
    base: nonNegativeNumber,
    exchangeRate: nonNegativeNumber,
  })
  .passthrough();

export const merchantRatesSchema = z.array(merchantRateSchema);

export type Auction = z.infer<typeof auctionSchema>;
export type AuctionCategory = z.infer<typeof auctionCategorySchema>;
export type MarketCategory = z.infer<typeof marketCategorySchema>;
export type MarketItem = z.infer<typeof marketItemSchema>;
export type MarketOrder = z.infer<typeof marketOrderSchema>;
export type MarketPriceResponse = z.infer<typeof marketPriceSchema>;
export type MarketPricesResponse = z.infer<typeof marketPricesSchema>;
export type HistoryPoint = z.infer<typeof historyPointSchema>;
export type MarketHistoryResponse = z.infer<typeof marketHistorySchema>;
export type MerchantRate = z.infer<typeof merchantRateSchema>;

export function parseAuctions(value: unknown): Auction[] {
  return auctionsSchema.parse(value);
}

export function parseMarketPrices(value: unknown): MarketPricesResponse {
  return marketPricesSchema.parse(value);
}

export function parseMarketHistory(value: unknown): MarketHistoryResponse {
  return marketHistorySchema.parse(value);
}

export function parseMerchantRates(value: unknown): MerchantRate[] {
  return merchantRatesSchema.parse(value);
}
