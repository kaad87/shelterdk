import { NextRequest } from "next/server";
import { getSuggestions } from "@/lib/soeg-db";

export const revalidate = 60;

/**
 * GET /api/soeg/byer?q=Thy
 * Returnerer byer og områder der matcher prefix (til autocomplete).
 * Format: [{ name: "Thy", type: "område" }, { name: "Thisted", type: "by" }]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const suggestions = await getSuggestions(q);
  return Response.json(suggestions);
}
