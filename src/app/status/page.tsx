import type { Metadata } from "next";
import { StatusDashboard } from "@/features/status/status-dashboard";

export const metadata: Metadata = {
  title: "API-Status",
  description: "Erreichbarkeit, Antwortzeit, Cache-Zustand und Datenalter aller bekannten öffentlichen OPSUCHT-Endpunkte.",
};

export default function StatusPage() {
  return <StatusDashboard />;
}
