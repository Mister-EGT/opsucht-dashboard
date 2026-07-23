import type { Metadata } from "next";
import { ApiExplorerDashboard } from "@/features/explorer/api-explorer-dashboard";

export const metadata: Metadata = {
  title: "API-Explorer",
  description: "Die bekannten öffentlichen OPSUCHT-GET-Endpunkte sicher ausführen und Antworten als JSON oder Baum untersuchen.",
};

export default function ApiExplorerPage() {
  return <ApiExplorerDashboard />;
}
