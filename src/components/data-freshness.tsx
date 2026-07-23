import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ApiMeta } from "@/lib/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

export function DataFreshness({ meta, fetching = false }: { meta?: ApiMeta; fetching?: boolean }) {
  if (!meta) return null;
  return (
    <div className={meta.stale ? "freshness freshness-stale" : "freshness"} title={`Letzte erfolgreiche Aktualisierung: ${formatDateTime(meta.lastSuccessAt)}`}>
      {meta.stale ? <AlertTriangle size={14} aria-hidden="true" /> : fetching ? <RefreshCw className="spin" size={14} aria-hidden="true" /> : <span className="status-dot status-ok" />}
      <span>{meta.stale ? "Möglicherweise veraltet" : `Aktualisiert ${formatRelativeTime(meta.cachedAt)}`}</span>
    </div>
  );
}
