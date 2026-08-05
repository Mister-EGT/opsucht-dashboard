"use client";

import Image from "next/image";
import { Check, Clipboard, Heart, UserRound } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type ReactNode, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import { ItemIcon } from "@/components/item-icon";
import { PriceValue } from "@/components/price-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { buildAuctionBidPriceHistory, type AuctionBidPricePoint } from "@/lib/auction";
import { formatDateTime, formatExactPrice, formatMaterialName, formatPrice } from "@/lib/format";
import { minecraftAvatarUrl, type MinecraftPlayerProfile } from "@/lib/minecraft-player";
import type { Auction } from "@/lib/schemas";
import { copyToClipboard } from "@/lib/utils";
import { useMinecraftPlayer } from "@/hooks/use-opsucht";

export function AuctionDialog({ auction, open, onClose, categoryName, now }: { auction: Auction | null; open: boolean; onClose: () => void; categoryName?: string; now: number }) {
  const favorites = useFavorites();
  const [copied, setCopied] = useState(false);
  const seller = useMinecraftPlayer(auction?.seller, open);
  const highestBidder = useMinecraftPlayer(auction?.highestBidder, open);
  if (!auction) return null;
  const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
  const expired = new Date(auction.endTime).getTime() <= now;
  const bidCount = Object.keys(auction.bids).length;
  const bidPriceHistory = buildAuctionBidPriceHistory(auction.startBid, auction.bids);

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
        <Detail label="Gebote" value={String(bidCount)} />
        <Detail label="Start" value={formatDateTime(auction.startTime)} />
        <Detail label="Ende" value={formatDateTime(auction.endTime)} />
      </dl>
      {bidCount > 1 ? (
        <div className="dialog-section">
          <h3>Preisverlauf</h3>
          <p className="auction-bid-chart-note">Startgebot und {bidCount} nach Betrag sortierte Gebote. Die OPSUCHT-API liefert keine Gebotszeitstempel.</p>
          <div
            className="chart-container auction-bid-chart"
            role="img"
            aria-label={`Preisverlauf mit ${bidCount} Geboten vom Startgebot ${formatExactPrice(auction.startBid)} bis ${formatExactPrice(auction.currentBid)}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bidPriceHistory} margin={{ top: 12, right: 16, bottom: 2, left: 4 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="step"
                  stroke="var(--text-muted)"
                  fontSize={10}
                  minTickGap={24}
                  tickFormatter={(value) => Number(value) === 0 ? "Start" : String(value)}
                />
                <YAxis
                  width={64}
                  domain={["auto", "auto"]}
                  stroke="var(--text-muted)"
                  fontSize={10}
                  tickFormatter={(value) => formatPrice(Number(value))}
                />
                <Tooltip content={<AuctionBidTooltip />} />
                <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={2} dot={bidPriceHistory.length < 20} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
      <div className="dialog-section">
        <h3>Beteiligte Spieler</h3>
        <div className="auction-player-grid">
          <PlayerIdentity
            label="Verkäufer"
            uuid={auction.seller}
            profile={seller.data}
            loading={seller.isFetching}
          />
          <PlayerIdentity
            label="Höchstbietender"
            uuid={auction.highestBidder}
            profile={highestBidder.data}
            loading={highestBidder.isFetching}
          />
        </div>
      </div>
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
        </dl>
      </div>
      <div className="dialog-footer-actions">
        <Button onClick={copyMaterial}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Kopiert" : "Material kopieren"}</Button>
        <Button variant={favorites.isAuctionFavorite(auction.uid) ? "primary" : "secondary"} onClick={() => favorites.toggleAuction(auction)}><Heart size={16} fill={favorites.isAuctionFavorite(auction.uid) ? "currentColor" : "none"} />{favorites.isAuctionFavorite(auction.uid) ? "Gespeichert" : "Favorisieren"}</Button>
      </div>
    </Dialog>
  );
}

function AuctionBidTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AuctionBidPricePoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip"><strong>{point.label}</strong><span>{formatExactPrice(point.price)}</span></div>;
}

function PlayerIdentity({
  label,
  uuid,
  profile,
  loading,
}: {
  label: string;
  uuid?: string;
  profile?: MinecraftPlayerProfile;
  loading: boolean;
}) {
  const avatarUrl = profile?.avatarUrl ?? (uuid ? minecraftAvatarUrl(uuid) : null);
  const name = loading ? "Name wird geladen" : profile?.name ?? (uuid ? "Name nicht verfügbar" : "Noch kein Gebot");
  const description = uuid
    ? profile?.platform === "bedrock" ? "Bedrock-Spieler" : "Minecraft-Spieler"
    : "Für diese Auktion liegt noch kein Höchstgebot vor.";

  return (
    <article className="auction-player" aria-live="polite">
      {avatarUrl ? (
        <Image
          className="auction-player-avatar"
          src={avatarUrl}
          alt={`Minecraft-Kopf von ${name}`}
          width={48}
          height={48}
          unoptimized
        />
      ) : (
        <span className="auction-player-avatar auction-player-avatar-fallback" aria-hidden="true">
          <UserRound size={23} />
        </span>
      )}
      <div className="auction-player-copy">
        <span>{label}</span>
        <strong>{name}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

function Detail({ label, value, monospace = false }: { label: string; value: ReactNode; monospace?: boolean }) {
  return <div className="detail-pair"><dt>{label}</dt><dd className={monospace ? "mono-value" : undefined}>{value}</dd></div>;
}
