import type { Metadata } from "next";
import { Suspense } from "react";
import { AuctionsDashboard } from "@/features/auctions/auctions-dashboard";
import { PageSkeleton } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Auktionshaus",
  description: "Aktive OPSUCHT-Auktionen durchsuchen, filtern, sortieren und lokal favorisieren.",
};

export default function AuctionsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuctionsDashboard /></Suspense>;
}
