import { auctionEndpoint, fetchOpsucht } from "@/server/opsucht-api";
import { opsuchtResponse, validationError } from "@/server/route-response";
import { validateCategory } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const categoryValue = params.get("category");
  const category = categoryValue ? validateCategory(categoryValue) : undefined;
  if (categoryValue && !category) return validationError("Die Auktionskategorie ist ungültig.");
  const refresh = params.get("refresh");
  if (refresh !== null && refresh !== "1") return validationError("Der Aktualisierungsparameter ist ungültig.");
  return opsuchtResponse(await fetchOpsucht(auctionEndpoint(category ?? undefined), { force: refresh === "1" }));
}
