import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton({ fetching, onRefresh, label = "Aktualisieren" }: { fetching: boolean; onRefresh: () => void; label?: string }) {
  return <Button size="sm" onClick={onRefresh} disabled={fetching} aria-label={fetching ? "Daten werden aktualisiert" : label}><RefreshCw size={14} className={fetching ? "spin" : undefined} /> {fetching ? "Lädt" : label}</Button>;
}
