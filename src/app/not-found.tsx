import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return <div className="page-narrow"><EmptyState title="Seite nicht gefunden" description="Die angeforderte Analyseansicht existiert nicht oder wurde verschoben." action={<LinkButton href="/" variant="primary">Zur Übersicht</LinkButton>} /></div>;
}
