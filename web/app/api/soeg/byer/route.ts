import { NextRequest } from "next/server";
import { getByerSuggestions } from "@/lib/soeg-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/soeg/byer?q=Bil
 * Returnerer bynavne der matcher prefix (til autocomplete).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const byer = await getByerSuggestions(q);
  return Response.json(byer);
}
