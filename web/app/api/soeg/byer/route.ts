import { NextRequest } from "next/server";
import { getSuggestions } from "@/lib/soeg-db";

// CRITICAL: Autocomplete must not be cached on shared CDNs. Even with
// force-dynamic, Cache-Control: public + s-maxage can still be honored at
// the edge with a cache key that omits ?q=, so every user sees one stale list
// (e.g. only "F…" matches). Use private, no-store for correct per-query results.
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
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
