"use client";

import { Check, Clipboard, Heart } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import { ItemIcon } from "@/components/item-icon";
import { PriceValue } from "@/components/price-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDateTime, formatMaterialName } from "@/lib/format";
import type { Auction } from "@/lib/schemas";
import { copyToClipboard } from "@/lib/utils";

export function AuctionDialog({ auction, open, onClose, categoryName, now }: { auction: Auction | null; open: boolean; onClose: () => void; categoryName?: string; now: number }) {
  const favorites = useFavorites();
  const [copied, setCopied] = useState(false);
  if (!auction) return null;
  const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
  const expired = new Date(auction.endTime).getTime() <= now;

  const copyMaterial = async () => {
    if (await copyToClipboard(auction.item.material)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={name} description="Technische und wirtschaftliche Auktionsdetails" wide>
      <div className="auction-dialog-hero">
        <ItemIcon src={auction.item.icon} name={name} size={64} />
        <div><Badge tone={expired ? "danger" : "success"}>{expired ? "Beendet" : "Aktiv"}</Badge><h3>{name}</h3><p>{auction.item.amount} Stück · {categoryName ?? auction.category}</p></div>
      </div>
      <dl className="detail-grid mt-4">
        <Detail label="Aktuelles Gebot" value={<PriceValue value={auction.currentBid} />} />
        <Detail label="Startgebot" value={<PriceValue value={auction.startBid} />} />
        <Detail label="Sofortkauf" value={<PriceValue value={auction.instantBuyPrice} />} />
        <Detail label="Gebote" value={String(Object.keys(auction.bids).length)} />
        <Detail label="Start" value={formatDateTime(auction.startTime)} />
        <Detail label="Ende" value={formatDateTime(auction.endTime)} />
      </dl>
      <div className="dialog-section">
        <h3>Iteminformationen</h3>
        {auction.item.lore.filter(Boolean).length ? <ul className="lore-list">{auction.item.lore.filter(Boolean).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ul> : <p className="muted-text">Für dieses Item ist keine Lore hinterlegt.</p>}
      </div>
      {Object.keys(auction.item.enchantments).length ? <div className="dialog-section"><h3>Verzauberungen</h3><div className="tag-list">{Object.entries(auction.item.enchantments).map(([enchantment, level]) => <Badge key={enchantment} tone="info">{formatMaterialName(enchantment)} {level}</Badge>)}</div></div> : null}
      <div className="dialog-section">
        <h3>Technische Kennungen</h3>
        <dl className="detail-grid">
          <Detail label="Material" value={auction.item.material} monospace />
          <Detail label="Auction-UID" value={auction.uid} monospace />
          <Detail label="Verkäufer-UUID" value={auction.seller ?? "Nicht verfügbar"} monospace />
          <Detail label="Höchstbietender" value={auction.highestBidder ?? "Noch kein Gebot"} monospace />
        </dl>
      </div>
      <div className="dialog-footer-actions">
        <Button onClick={copyMaterial}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Kopiert" : "Material kopieren"}</Button>
        <Button variant={favorites.isAuctionFavorite(auction.uid) ? "primary" : "secondary"} onClick={() => favorites.toggleAuction(auction)}><Heart size={16} fill={favorites.isAuctionFavorite(auction.uid) ? "currentColor" : "none"} />{favorites.isAuctionFavorite(auction.uid) ? "Gespeichert" : "Favorisieren"}</Button>
      </div>
    </Dialog>
  );
}

function Detail({ label, value, monospace = false }: { label: string; value: ReactNode; monospace?: boolean }) {
  return <div className="detail-pair"><dt>{label}</dt><dd className={monospace ? "mono-value" : undefined}>{value}</dd></div>;
}
