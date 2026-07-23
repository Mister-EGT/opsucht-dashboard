import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketDashboard } from "@/features/market/market-dashboard";
import { PageSkeleton } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Marktübersicht",
  description: "Alle OPSUCHT-Marktitems mit BUY- und SELL-Kursen, Aufträgen und transparent berechneten Spreads.",
};

export default function MarketPage() {
  return <Suspense fallback={<PageSkeleton />}><MarketDashboard /></Suspense>;
}
