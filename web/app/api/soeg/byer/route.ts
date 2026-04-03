import { NextRequest } from "next/server";
import { getSuggestions } from "@/lib/soeg-db";

// CRITICAL: force-dynamic prevents Netlify CDN from caching this route.
// Without this, Netlify caches the first response and serves it for ALL
// query parameters, breaking autocomplete after a few minutes.
export const dynamic = "force-dynamic";

/**
 * GET /api/soeg/byer?q=Thy
 * Returnerer byer og områder der matcher prefix (til autocomplete).
 * Format: [{ name: "Thy", type: "område" }, { name: "Thisted", type: "by" }]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const suggestions = await getSuggestions(q);
  return Response.json(suggestions, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
