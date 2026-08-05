import type { Metadata } from "next";
import { Suspense } from "react";
import { MerchantDashboard } from "@/features/merchant/merchant-dashboard";
import { PageSkeleton } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Händler, OPShards und Redcoins",
  description: "Aktuelle OPSUCHT-Händlerkurse für OPShards und Redcoins, lesbar aufbereitete Custom-Items und ein transparenter Währungsrechner.",
};

export default function MerchantPage() {
  return <Suspense fallback={<PageSkeleton />}><MerchantDashboard /></Suspense>;
}
