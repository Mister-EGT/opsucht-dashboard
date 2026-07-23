import { fetchOpsucht, marketHistoryEndpoint } from "@/server/opsucht-api";
import { opsuchtResponse, validationError } from "@/server/route-response";
import { validateMaterial } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ material: string }> },
) {
  const material = validateMaterial((await params).material);
  if (!material) return validationError("Der Materialname ist ungültig.");
  return opsuchtResponse(await fetchOpsucht(marketHistoryEndpoint(material)));
}
