import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function MetricCard({ label, value, note, icon: Icon, color, title }: { label: string; value: string; note: string; icon: LucideIcon; color?: string; title?: string }) {
  return (
    <Card className="metric-card" style={color ? ({ "--metric-color": color } as React.CSSProperties) : undefined}>
      <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} aria-hidden="true" /></span></div>
      <div className="metric-value" title={title ?? value}>{value}</div>
      <div className="metric-note">{note}</div>
    </Card>
  );
}
