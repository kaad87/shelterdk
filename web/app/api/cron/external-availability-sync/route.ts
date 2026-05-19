import { NextRequest, NextResponse } from "next/server";
import {
  syncNaturstyrelsenAvailabilityBatch,
  type NaturstyrelsenSyncResult,
} from "@/lib/naturstyrelsen-availability";
import {
  recordBookingMonitorError,
  recordBookingMonitorEvent,
} from "@/lib/booking-monitor";

export const dynamic = "force-dynamic";

function summarize(results: NaturstyrelsenSyncResult[]) {
  const success = results.filter((result) => result.status === "success");
  const skipped = results.filter((result) => result.status === "skipped");
  const errors = results.filter((result) => result.status === "error");

  return {
    successCount: success.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    refreshedPidCount: success.filter((result) => result.hadPidRefresh).length,
    sampleErrors: errors.slice(0, 20).map((result) => ({
      slug: result.slug,
      reason: result.reason,
    })),
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await syncNaturstyrelsenAvailabilityBatch();
    const summary = summarize(results);

    if (summary.errorCount > 0) {
      await recordBookingMonitorEvent({
        severity: "warning",
        source: "api/cron/external-availability-sync",
        eventType: "external_availability_partial_failure",
        message: `NST availability sync havde ${summary.errorCount} fejl`,
        metadata: summary,
        notify: false,
      });
    } else if (summary.successCount > 0) {
      await recordBookingMonitorEvent({
        severity: "info",
        source: "api/cron/external-availability-sync",
        eventType: "external_availability_synced",
        message: `NST availability synkroniseret for ${summary.successCount} shelter(s)`,
        metadata: summary,
        needsAttention: false,
      });
    }

    return NextResponse.json({ ok: true, ...summary, results });
  } catch (error) {
    await recordBookingMonitorError({
      severity: "error",
      source: "api/cron/external-availability-sync",
      eventType: "external_availability_sync_failed",
      message: "NST availability cron fejlede",
      error,
      notify: true,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ukendt fejl i availability cron",
      },
      { status: 500 }
    );
  }
}

