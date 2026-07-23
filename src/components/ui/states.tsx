"use client";

import { AlertTriangle, Inbox, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("skeleton", className)} aria-hidden="true" />;
}

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Daten werden geladen" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <div className="card p-5" key={index}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-8 w-36" />
            <Skeleton className="mt-3 h-3 w-44" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <Skeleton className="h-5 w-48" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton className="h-12 w-full" key={index} />)}
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state-panel" role="alert">
      <span className="state-icon state-icon-danger"><WifiOff aria-hidden="true" /></span>
      <h2>Daten derzeit nicht verfügbar</h2>
      <p>{message ?? "Dieser Bereich konnte nicht geladen werden. Andere Teile des Dashboards bleiben nutzbar."}</p>
      {onRetry ? <Button onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Erneut versuchen</Button> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="state-panel">
      <span className="state-icon"><Inbox aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function StaleBanner({ message }: { message?: string }) {
  return (
    <div className="stale-banner" role="status">
      <AlertTriangle size={17} aria-hidden="true" />
      <span>{message ?? "Live-Aktualisierung fehlgeschlagen. Angezeigt werden die zuletzt erfolgreich geladenen Daten."}</span>
    </div>
  );
}
