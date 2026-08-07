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
  group: "Analyse" | "Werkzeuge";
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  { href: "/", label: "Übersicht", description: "Kennzahlen und Marktimpulse", group: "Analyse", icon: LayoutDashboard },
  { href: "/auctions", label: "Auktionshaus", shortLabel: "Auktionen", description: "Aktive Auktionen analysieren", group: "Analyse", icon: Gavel },
  { href: "/market", label: "Markt", description: "Preise, Aufträge und Spreads", group: "Analyse", icon: Store },
  { href: "/merchant", label: "Händler", description: "OPShards, Redcoins und Kurse", group: "Analyse", icon: CircleDollarSign },
  { href: "/calculator", label: "Vergleichsrechner", shortLabel: "Rechner", description: "Portfolios und Werte vergleichen", group: "Werkzeuge", icon: Calculator },
  { href: "/favorites", label: "Favoriten", description: "Gespeicherte Items und Auktionen", group: "Werkzeuge", icon: Heart },
  { href: "/status", label: "API-Status", shortLabel: "Status", description: "Erreichbarkeit und Cache-Zustand", group: "Werkzeuge", icon: Activity },
  { href: "/api-explorer", label: "API-Explorer", shortLabel: "Explorer", description: "Öffentliche Endpunkte untersuchen", group: "Werkzeuge", icon: Compass },
];

export function pageLabel(pathname: string): string {
  if (pathname.startsWith("/market/")) return "Item-Analyse";
  if (pathname.startsWith("/admin")) return "Administration";
  if (pathname.startsWith("/account")) return "Konto";
  return navigationItems.find((item) => item.href === pathname)?.label ?? "Dashboard";
}
