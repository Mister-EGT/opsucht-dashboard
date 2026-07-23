"use client";

import Link from "next/link";
import { CircleDollarSign, Gavel, Heart, Store, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import { ItemIcon } from "@/components/item-icon";
import { PriceValue } from "@/components/price-value";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { useAuctions, useMarketItems, useMarketPrices, useMerchantRates } from "@/hooks/use-opsucht";
import { formatEconomyValue, formatMaterialName, formatRelativeTime } from "@/lib/format";
import { flattenMarketPrices } from "@/lib/market";
import { normalizeMerchantRates } from "@/lib/merchant";
import { normalizeMaterialKey } from "@/lib/material";

export function FavoritesDashboard() {
  const favorites = useFavorites();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const hasMarketFavorites = favorites.hydrated && favorites.market.length > 0;
  const hasMerchantFavorites = favorites.hydrated && favorites.merchant.length > 0;
  const hasAuctionFavorites = favorites.hydrated && favorites.auctions.length > 0;
  const prices = useMarketPrices(hasMarketFavorites);
  const items = useMarketItems(hasMarketFavorites);
  const merchants = useMerchantRates(hasMerchantFavorites);
  const auctions = useAuctions(undefined, hasAuctionFavorites);
  const marketRows = useMemo(() => flattenMarketPrices(prices.data?.data ?? {}, items.data?.data ?? []), [prices.data, items.data]);
  const merchantRows = useMemo(() => normalizeMerchantRates(merchants.data?.data ?? []), [merchants.data]);
  const favoriteMarket = favorites.market.map((material) => ({ material, row: marketRows.find((row) => normalizeMaterialKey(row.material) === normalizeMaterialKey(material)) }));
  const favoriteMerchants = favorites.merchant.map((id) => ({ id, rate: merchantRows.find((rate) => rate.id === id) }));
  const liveAuctionMap = new Map((auctions.data?.data ?? []).map((auction) => [auction.uid, auction]));
  const auctionFavorites = favorites.auctions.map((favorite) => ({ favorite, auction: liveAuctionMap.get(favorite.id) ?? favorite.snapshot }));
  const total = favorites.market.length + favorites.merchant.length + favorites.auctions.length;

  const loading = !favorites.hydrated
    || (hasMarketFavorites && (prices.isPending || items.isPending))
    || (hasMerchantFavorites && merchants.isPending)
    || (hasAuctionFavorites && auctions.isPending);
  if (loading) return <><PageHeader eyebrow="Persönlich" title="Favoriten" description="Gespeicherte Items und Auktionen auf diesem Gerät." /><PageSkeleton /></>;
  const stale = [prices.data?.meta, merchants.data?.meta, auctions.data?.meta].some((meta) => meta?.stale);
  const unavailableAreas = [prices.isError ? "Marktpreise" : null, items.isError ? "Item-Metadaten" : null, merchants.isError ? "Händlerkurse" : null, auctions.isError ? "Auktionen" : null]
    .filter((area): area is string => area !== null);

  return (
    <>
      <PageHeader eyebrow="Persönlich" title="Favoriten" description="Marktitems, Händlerkurse und Auktions-Snapshots werden lokal im Browser gespeichert und mit Live-Daten abgeglichen." actions={<Badge tone="accent"><Heart size={13} /> {total} gespeichert</Badge>} />
      {stale ? <StaleBanner /> : null}
      {unavailableAreas.length ? <StaleBanner message={`Der Live-Abgleich ist für folgende Bereiche vorübergehend nicht verfügbar: ${unavailableAreas.join(", ")}. Gespeicherte Favoriten bleiben erhalten.`} /> : null}
      {total === 0 ? <EmptyState title="Noch keine Favoriten" description="Speichere Items oder Auktionen über das Herzsymbol. Deine Auswahl bleibt lokal auf diesem Gerät erhalten." action={<LinkButton href="/market" variant="primary">Markt entdecken</LinkButton>} /> : (
        <div className="favorites-grid">
          <Card>
            <CardHeader title="Marktitems" description={`${favorites.market.length} gespeichert`} action={<Store size={18} className="section-icon" />} />
            <div className="favorite-list">
              {favoriteMarket.length ? favoriteMarket.map(({ material, row }) => (
                <article className="favorite-row" key={material}>
                  <ItemIcon src={row?.icon} name={row?.name ?? formatMaterialName(material)} size={41} />
                  <div className="favorite-main"><Link href={`/market/${encodeURIComponent(material)}`}><strong>{row?.name ?? formatMaterialName(material)}</strong></Link><small>{row ? `${row.category} · ${material}` : `${material} · Aktuell nicht im Marktfeed`}</small></div>
                  <div className="favorite-value"><strong><PriceValue value={row?.buyPrice} /></strong><small>BUY-Kurs</small></div>
                  <Button variant="ghost" size="icon" onClick={() => favorites.toggleMarket(material)} aria-label="Marktitem entfernen"><Trash2 size={16} /></Button>
                </article>
              )) : <CompactEmpty text="Keine Marktitems gespeichert." />}
            </div>
          </Card>

          <Card>
            <CardHeader title="Händleritems" description={`${favorites.merchant.length} gespeichert`} action={<CircleDollarSign size={18} className="section-icon" />} />
            <div className="favorite-list">
              {favoriteMerchants.length ? favoriteMerchants.map(({ id, rate }) => (
                <article className="favorite-row" key={id}>
                  <ItemIcon name={rate?.displayName ?? formatMaterialName(id)} size={41} />
                  <div className="favorite-main"><Link href={`/merchant?q=${encodeURIComponent(rate?.displayName ?? id)}`}><strong>{rate?.displayName ?? formatMaterialName(id)}</strong></Link><small>{rate ? rate.materialKey : `${id} · Aktuell nicht im Händlerfeed`}</small></div>
                  <div className="favorite-value"><strong>{rate ? `${formatEconomyValue(rate.exchangeRate)} OPShards` : "Nicht verfügbar"}</strong><small>Wechselkurs</small></div>
                  <Button variant="ghost" size="icon" onClick={() => favorites.toggleMerchant(id)} aria-label="Händleritem entfernen"><Trash2 size={16} /></Button>
                </article>
              )) : <CompactEmpty text="Keine Händleritems gespeichert." />}
            </div>
          </Card>

          <Card className="favorites-auctions">
            <CardHeader title="Auktionen" description={`${favorites.auctions.length} gespeicherte Snapshots`} action={<Gavel size={18} className="section-icon" />} />
            <div className="favorite-list">
              {auctionFavorites.length ? auctionFavorites.map(({ favorite, auction }) => {
                const live = liveAuctionMap.has(favorite.id);
                const ended = !live || new Date(auction.endTime).getTime() <= now;
                const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
                return (
                  <article className="favorite-row" key={favorite.id}>
                    <ItemIcon src={auction.item.icon} name={name} size={41} />
                    <div className="favorite-main"><Link href={`/auctions?q=${encodeURIComponent(name)}`}><strong>{name}</strong></Link><small>{auction.item.amount} Stück · gespeichert {formatRelativeTime(favorite.savedAt)}</small></div>
                    <Badge tone={ended ? "danger" : "success"}>{ended ? "Beendet oder nicht mehr aktiv" : `Endet ${formatRelativeTime(auction.endTime)}`}</Badge>
                    <div className="favorite-value"><strong><PriceValue value={auction.currentBid} /></strong><small>Letztes Gebot</small></div>
                    <Button variant="ghost" size="icon" onClick={() => favorites.removeAuction(favorite.id)} aria-label="Auktionsfavorit entfernen"><Trash2 size={16} /></Button>
                  </article>
                );
              }) : <CompactEmpty text="Keine Auktionen gespeichert." />}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return <div className="compact-empty"><Heart size={20} /><p>{text}</p></div>;
}
