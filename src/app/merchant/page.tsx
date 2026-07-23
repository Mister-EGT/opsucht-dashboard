import type { Metadata } from "next";
import { Suspense } from "react";
import { MerchantDashboard } from "@/features/merchant/merchant-dashboard";
import { PageSkeleton } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Händler und OPShards",
  description: "Aktuelle OPSUCHT-Händlerkurse, lesbar aufbereitete Custom-Items und ein transparenter OPShards-Rechner.",
};

export default function MerchantPage() {
  return <Suspense fallback={<PageSkeleton />}><MerchantDashboard /></Suspense>;
}
