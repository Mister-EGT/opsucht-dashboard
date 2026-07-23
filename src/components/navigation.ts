import {
  Activity,
  Calculator,
  CircleDollarSign,
  Compass,
  Gavel,
  Heart,
  LayoutDashboard,
  Store,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  { href: "/", label: "Übersicht", description: "Kennzahlen und Marktimpulse", icon: LayoutDashboard },
  { href: "/auctions", label: "Auktionshaus", shortLabel: "Auktionen", description: "Aktive Auktionen analysieren", icon: Gavel },
  { href: "/market", label: "Markt", description: "Preise, Aufträge und Spreads", icon: Store },
  { href: "/merchant", label: "Händler", description: "OPShards und Wechselkurse", icon: CircleDollarSign },
  { href: "/calculator", label: "Vergleichsrechner", shortLabel: "Rechner", description: "Portfolios und Werte vergleichen", icon: Calculator },
  { href: "/favorites", label: "Favoriten", description: "Gespeicherte Items und Auktionen", icon: Heart },
  { href: "/status", label: "API-Status", shortLabel: "Status", description: "Erreichbarkeit und Cache-Zustand", icon: Activity },
  { href: "/api-explorer", label: "API-Explorer", shortLabel: "Explorer", description: "Öffentliche Endpunkte untersuchen", icon: Compass },
];

export function pageLabel(pathname: string): string {
  if (pathname.startsWith("/market/")) return "Item-Analyse";
  return navigationItems.find((item) => item.href === pathname)?.label ?? "Dashboard";
}
