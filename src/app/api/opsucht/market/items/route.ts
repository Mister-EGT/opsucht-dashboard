import { fetchOpsucht, staticEndpoints } from "@/server/opsucht-api";
import { opsuchtResponse } from "@/server/route-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return opsuchtResponse(await fetchOpsucht(staticEndpoints.marketItems));
}
