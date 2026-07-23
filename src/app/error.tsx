"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <div className="page-narrow"><ErrorState message="Beim Anzeigen dieser Seite ist ein unerwarteter Fehler aufgetreten." onRetry={reset} /></div>;
}
