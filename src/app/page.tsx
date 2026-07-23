import type { Metadata } from "next";
import { OverviewDashboard } from "@/features/overview/overview-dashboard";

export const metadata: Metadata = {
  title: "Übersicht",
  description: "Live-Überblick über Auktionen, Marktpreise, Preisbewegungen und Händlerkurse auf OPSUCHT.",
};

export default function HomePage() {
  return <OverviewDashboard />;
}
