import { createAdminClient } from "@/utils/supabase/server-admin";
import { escapeHtml, renderEmail, renderEmailText, sendLoggedEmail } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

export type BookingMonitorSeverity = "info" | "warning" | "error" | "critical";

export interface BookingMonitorEventInput {
  severity: BookingMonitorSeverity;
  source: string;
  eventType: string;
  message: string;
  bookingId?: string | null;
  paymentId?: string | null;
  shelterId?: string | null;
  metadata?: Record<string, unknown>;
  needsAttention?: boolean;
  notify?: boolean;
}

export interface BookingMonitorEventRow {
  id: string;
  created_at: string;
  severity: BookingMonitorSeverity;
  source: string;
  event_type: string;
  message: string;
  booking_id: string | null;
  payment_id: string | null;
  shelter_id: string | null;
  metadata: Record<string, unknown>;
  needs_attention: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

function shouldAlert(input: BookingMonitorEventInput) {
  if (typeof input.notify === "boolean") return input.notify;
  return input.severity === "critical";
}

function sanitizeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.slice(0, 2000),
    };
  }
  return { value: String(err) };
}

async function sendBookingMonitorAlert(event: BookingMonitorEventInput) {
  const to = process.env.BOOKING_ALERT_EMAIL;
  if (!to) return;

  const recipients = to
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;

  const adminUrl = `${SITE_URL}/admin/booking-monitor`;
  const metaJson = event.metadata
    ? JSON.stringify(event.metadata, null, 2)
    : "{}";

  await sendLoggedEmail({
    to: recipients,
    subject: `[ShelterDK booking] ${event.severity.toUpperCase()} — ${event.message}`,
    html: renderEmail({
      title: "Booking-system alert",
      preheader: `${event.source}: ${event.message}`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
          En booking-hændelse kræver muligvis opmærksomhed.
        </p>
        <p style="font-size:13px;color:#555;line-height:1.65;margin:0 0 6px;"><strong>Severity:</strong> ${escapeHtml(event.severity)}</p>
        <p style="font-size:13px;color:#555;line-height:1.65;margin:0 0 6px;"><strong>Kilde:</strong> ${escapeHtml(event.source)}</p>
        <p style="font-size:13px;color:#555;line-height:1.65;margin:0 0 6px;"><strong>Type:</strong> ${escapeHtml(event.eventType)}</p>
        <p style="font-size:13px;color:#555;line-height:1.65;margin:0 0 12px;"><strong>Besked:</strong> ${escapeHtml(event.message)}</p>
        ${
          event.bookingId
            ? `<p style="font-size:12px;color:#777;margin:0 0 4px;"><strong>Booking:</strong> ${escapeHtml(event.bookingId)}</p>`
            : ""
        }
        ${
          event.paymentId
            ? `<p style="font-size:12px;color:#777;margin:0 0 4px;"><strong>Payment:</strong> ${escapeHtml(event.paymentId)}</p>`
            : ""
        }
        ${
          event.shelterId
            ? `<p style="font-size:12px;color:#777;margin:0 0 12px;"><strong>Shelter:</strong> ${escapeHtml(event.shelterId)}</p>`
            : ""
        }
        <pre style="white-space:pre-wrap;background:#f7f5f1;border:1px solid #ece6db;border-radius:8px;padding:12px;font-size:11px;line-height:1.45;color:#444;margin:0 0 16px;">${escapeHtml(metaJson)}</pre>
        <a href="${adminUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Åbn booking-monitor</a>
      `,
    }),
    text: renderEmailText({
      title: "Booking-system alert",
      lines: [
        `Severity: ${event.severity}`,
        `Kilde: ${event.source}`,
        `Type: ${event.eventType}`,
        `Besked: ${event.message}`,
        ...(event.bookingId ? [`Booking: ${event.bookingId}`] : []),
        ...(event.paymentId ? [`Payment: ${event.paymentId}`] : []),
        ...(event.shelterId ? [`Shelter: ${event.shelterId}`] : []),
        "",
        metaJson,
      ],
      url: adminUrl,
    }),
    context: {
      category: "monitor",
      emailType: "booking_monitor_alert",
      bookingId: event.bookingId ?? null,
      paymentId: event.paymentId ?? null,
      shelterId: event.shelterId ?? null,
      metadata: {
        severity: event.severity,
        source: event.source,
        eventType: event.eventType,
        needsAttention: event.needsAttention ?? null,
      },
    },
  });
}

export async function recordBookingMonitorEvent(input: BookingMonitorEventInput) {
  try {
    const row = {
      severity: input.severity,
      source: input.source,
      event_type: input.eventType,
      message: input.message,
      booking_id: input.bookingId ?? null,
      payment_id: input.paymentId ?? null,
      shelter_id: input.shelterId ?? null,
      metadata: input.metadata ?? {},
      needs_attention:
        typeof input.needsAttention === "boolean"
          ? input.needsAttention
          : input.severity === "warning" || input.severity === "error" || input.severity === "critical",
    };

    const { error } = await createAdminClient().from("booking_monitor_events").insert(row);
    if (error) {
      console.error("booking monitor insert failed:", error);
      return;
    }

    if (shouldAlert(input)) {
      sendBookingMonitorAlert(input).catch((err) => {
        console.error("booking monitor alert email failed:", err);
      });
    }
  } catch (err) {
    console.error("booking monitor error:", err);
  }
}

export async function recordBookingMonitorError(
  input: Omit<BookingMonitorEventInput, "severity" | "message" | "metadata"> & {
    message: string;
    error: unknown;
    severity?: BookingMonitorSeverity;
    metadata?: Record<string, unknown>;
  }
) {
  return recordBookingMonitorEvent({
    severity: input.severity ?? "error",
    source: input.source,
    eventType: input.eventType,
    message: input.message,
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    shelterId: input.shelterId,
    needsAttention: input.needsAttention,
    notify: input.notify,
    metadata: {
      ...(input.metadata ?? {}),
      error: sanitizeError(input.error),
    },
  });
}

export async function listBookingMonitorEvents(opts?: {
  severity?: BookingMonitorSeverity | "all";
  status?: "open" | "acknowledged" | "resolved" | "all";
  limit?: number;
}) {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
  let query = createAdminClient()
    .from("booking_monitor_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.severity && opts.severity !== "all") {
    query = query.eq("severity", opts.severity);
  }
  if (opts?.status === "open") {
    query = query.is("acknowledged_at", null).is("resolved_at", null);
  } else if (opts?.status === "acknowledged") {
    query = query.not("acknowledged_at", "is", null).is("resolved_at", null);
  } else if (opts?.status === "resolved") {
    query = query.not("resolved_at", "is", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Kunne ikke hente booking monitor events: ${error.message}`);
  return (data ?? []) as BookingMonitorEventRow[];
}

export async function acknowledgeBookingMonitorEvent(id: string, actor: string) {
  const { error } = await createAdminClient()
    .from("booking_monitor_events")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: actor,
    })
    .eq("id", id)
    .is("acknowledged_at", null);
  if (error) throw new Error(`Kunne ikke acknowledge hændelse: ${error.message}`);
}

export async function resolveBookingMonitorEvent(id: string, actor: string) {
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("booking_monitor_events")
    .update({
      resolved_at: now,
      resolved_by: actor,
      acknowledged_at: now,
      acknowledged_by: actor,
    })
    .eq("id", id)
    .is("resolved_at", null);
  if (error) throw new Error(`Kunne ikke markere hændelse som løst: ${error.message}`);
}
