"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/utils";

export function ShareCurrentView() {
  const { notify } = useToast();

  const share = async () => {
    const data = { title: document.title, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    const copied = await copyToClipboard(data.url);
    notify(copied ? "Link zur aktuellen Ansicht kopiert." : "Der Link konnte nicht kopiert werden.", copied ? "success" : "danger");
  };

  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" className="topbar-icon-action" onClick={share} aria-label="Aktuelle Ansicht teilen" />}>
        <Share2 aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Aktuelle Ansicht teilen</TooltipContent>
    </Tooltip>
  );
}
