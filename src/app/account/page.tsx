import type { Metadata } from "next";
import { AccountDashboard } from "@/features/account/account-dashboard";

export const metadata: Metadata = {
  title: "Konto",
  description: "OPSUCHT-Dashboard-Konto, Profil und geräteübergreifende Favoriten verwalten.",
};

export default function AccountPage() {
  return <AccountDashboard />;
}
