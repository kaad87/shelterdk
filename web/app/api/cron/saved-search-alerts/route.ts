import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { Shelter } from "@/types/shelter";
import type { SoegFilters } from "@/lib/soeg-db";
import { matchesSavedSearch, type SavedSearchRow } from "@/lib/saved-searches";
import { sendSavedSearchAlert } from "@/lib/saved-search-email";

export const dynamic = "force-dynamic";

/**
 * Saved-search alert cron.
 *
 * Beskyttet med `CRON_SECRET`. Iterer alle bekræftede saved_searches og
 * sender e-mail hvis der er nye shelters matching kriterierne siden
 * sidste kørsel (eller siden tilmelding, hvis aldrig kørt).
 *
 * Idempotent: opdaterer last_run_at uanset om der blev sendt, så vi
 * ikke spammer ved manuelt re-trigger.
 *
 * Scheduled via netlify/functions/saved-search-alerts-cron.mts (daglig).
 */

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, booking_url, booking_link_mode, region, kommune, place, water, toilet, capacity, geofa_raw, google_user_ratings_total, created_at, bookable_shelters(id)";

const PER_SEARCH_LIMIT = 50;

interface RunStats {
  total: number;
  notified: number;
  skipped: number;
  errors: number;
}

async function findNewMatchesForSearch(
  row: SavedSearchRow
): Promise<Shelter[]> {
  const admin = createAdminClient();
  const since = row.last_run_at ?? row.created_at;

  let query = admin
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(PER_SEARCH_LIMIT);

  if (row.region) query = query.eq("region", row.region);
  if (row.area) query = query.eq("area_slug", row.area);
  // q (fritekst) gør vi ikke server-side her — for upålidelig på en
  // periodisk cron. Vi accepterer at q-baserede saved-searches kun
  // matcher på region/area/filtre, ikke fritekst.

  const { data, error } = await query;
  if (error) {
    console.error("saved-search cron: shelter query failed", error);
    return [];
  }
  const shelters = (data ?? []) as Shelter[];
  return shelters.filter((s) => matchesSavedSearch(s, row.filters as SoegFilters | null));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const xCron = req.headers.get("x-cron-secret") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (xCron !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("saved_searches")
    .select("*")
    .not("confirmed_at", "is", null)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) {
    console.error("saved-search cron: list failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats: RunStats = { total: (rows ?? []).length, notified: 0, skipped: 0, errors: 0 };
  const nowIso = new Date().toISOString();

  for (const row of (rows ?? []) as SavedSearchRow[]) {
    try {
      const matches = await findNewMatchesForSearch(row);
      if (matches.length === 0) {
        await admin.from("saved_searches").update({ last_run_at: nowIso }).eq("id", row.id);
        stats.skipped += 1;
        continue;
      }
      await sendSavedSearchAlert(row, matches);
      await admin
        .from("saved_searches")
        .update({
          last_run_at: nowIso,
          last_notified_at: nowIso,
          notify_count: (row.notify_count ?? 0) + 1,
        })
        .eq("id", row.id);
      stats.notified += 1;
    } catch (err) {
      console.error("saved-search cron: row failed", row.id, err);
      stats.errors += 1;
    }
  }

  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    ...stats,
  });
}
