import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { describeAdminDataError } from "@/lib/admin-route-errors";
import {
  acknowledgeBookingMonitorEvent,
  listBookingMonitorEvents,
  resolveBookingMonitorEvent,
  type BookingMonitorSeverity,
} from "@/lib/booking-monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const severity = (searchParams.get("severity") ?? "all") as BookingMonitorSeverity | "all";
  const status = (searchParams.get("status") ?? "open") as "open" | "acknowledged" | "resolved" | "all";
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200);

  try {
    const events = await listBookingMonitorEvents({ severity, status, limit });
    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json(
      {
        error: describeAdminDataError(err, {
          entityLabel: "Booking-monitoren",
          tableName: "booking_monitor_events",
          migrationFile: "20260511_booking_monitor_events.sql",
          fallbackMessage: "Kunne ikke hente booking-monitor lige nu.",
        }),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { id?: string; action?: "acknowledge" | "resolve"; actor?: string }
    | null;

  if (!body?.id || !body.action) {
    return NextResponse.json({ error: "Mangler id eller action" }, { status: 400 });
  }

  const actor = body.actor?.trim() || "admin";
  try {
    if (body.action === "acknowledge") {
      await acknowledgeBookingMonitorEvent(body.id, actor);
    } else if (body.action === "resolve") {
      await resolveBookingMonitorEvent(body.id, actor);
    } else {
      return NextResponse.json({ error: "Ugyldig action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: describeAdminDataError(err, {
          entityLabel: "Booking-monitoren",
          tableName: "booking_monitor_events",
          migrationFile: "20260511_booking_monitor_events.sql",
          fallbackMessage: "Kunne ikke opdatere booking-monitor lige nu.",
        }),
      },
      { status: 500 }
    );
  }
}
