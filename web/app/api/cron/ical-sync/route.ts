import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { syncIcalForShelter } from "@/lib/ical-sync";
import { recordBookingMonitorEvent } from "@/lib/booking-monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all shelters with an import URL
  const { data: shelters, error } = await createAdminClient()
    .from("bookable_shelters")
    .select("id, title, ical_import_url")
    .not("ical_import_url", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let synced = 0;
  const errors: string[] = [];

  // Sequential — avoids hammering external servers
  for (const shelter of shelters ?? []) {
    if (!shelter.ical_import_url) continue;
    try {
      await syncIcalForShelter(shelter.id, shelter.ical_import_url);
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`iCal sync failed for shelter ${shelter.id}:`, msg);
      errors.push(`${shelter.title}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    await recordBookingMonitorEvent({
      severity: "warning",
      source: "api/cron/ical-sync",
      eventType: "ical_sync_partial_failure",
      message: `iCal sync havde ${errors.length} fejl`,
      metadata: { synced, errors: errors.slice(0, 20) },
      notify: false,
    });
  }

  return NextResponse.json({ ok: true, synced, errors });
}
