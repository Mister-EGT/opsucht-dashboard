import type { Metadata } from "next";
import { FavoritesDashboard } from "@/features/favorites/favorites-dashboard";

export const metadata: Metadata = {
  title: "Favoriten",
  description: "Lokal gespeicherte OPSUCHT-Marktitems, Händlerkurse und Auktionen mit aktuellen Live-Daten abgleichen.",
};

export default function FavoritesPage() {
  return <FavoritesDashboard />;
}
