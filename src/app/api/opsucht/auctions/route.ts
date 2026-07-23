import { auctionEndpoint, fetchOpsucht } from "@/server/opsucht-api";
import { opsuchtResponse, validationError } from "@/server/route-response";
import { validateCategory } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const categoryValue = new URL(request.url).searchParams.get("category");
  const category = categoryValue ? validateCategory(categoryValue) : undefined;
  if (categoryValue && !category) return validationError("Die Auktionskategorie ist ungültig.");
  return opsuchtResponse(await fetchOpsucht(auctionEndpoint(category ?? undefined)));
}
