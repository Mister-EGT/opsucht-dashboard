import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemDetailDashboard } from "@/features/market/item-detail-dashboard";
import { formatMaterialName } from "@/lib/format";
import { safeDecodeURIComponent } from "@/lib/utils";
import { validateMaterial } from "@/lib/validation";

export async function generateMetadata({ params }: { params: Promise<{ material: string }> }): Promise<Metadata> {
  const material = validateMaterial(safeDecodeURIComponent((await params).material));
  if (!material) {
    return {
      title: "Ungültiges Marktitem",
      description: "Der angeforderte Materialname ist ungültig.",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: formatMaterialName(material),
    description: `Aktuelle Marktpreise, Spread und Preisverlauf für ${formatMaterialName(material)} auf OPSUCHT.`,
  };
}

export default async function MarketItemPage({ params }: { params: Promise<{ material: string }> }) {
  const material = validateMaterial(safeDecodeURIComponent((await params).material));
  if (!material) notFound();
  return <ItemDetailDashboard material={material} />;
}
