export interface AuctionBidPricePoint {
  step: number;
  label: string;
  price: number;
}

export function buildAuctionBidPriceHistory(
  startBid: number,
  bids: Record<string, number>,
): AuctionBidPricePoint[] {
  const sortedBids = [...Object.values(bids)].sort((left, right) => left - right);

  return [
    { step: 0, label: "Startgebot", price: startBid },
    ...sortedBids.map((price, index) => ({
      step: index + 1,
      label: `Gebot ${index + 1}`,
      price,
    })),
  ];
}
