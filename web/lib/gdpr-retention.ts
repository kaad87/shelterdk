import { createAdminClient } from "@/utils/supabase/server-admin";

/**
 * GDPR retention helpers.
 *
 * Storage limitation principle (Article 5(1)(e)) requires us to delete or
 * anonymise personal data once it is no longer necessary for the purpose
 * it was collected for.
 *
 * Strategy:
 *  - Confirmed/completed bookings stay intact for 24 months (accounting +
 *    dispute window) and then have their PII scrubbed; the row stays so
 *    we keep aggregate stats and refer-back records.
 *  - Cancelled/rejected bookings have their PII scrubbed after 90 days.
 *  - Contact messages older than 12 months are deleted.
 *  - Rejected community submissions older than 60 days are deleted.
 *  - Newsletter unsubscribes are handled by hard-delete in the unsubscribe
 *    route, so no retention cleanup is needed here.
 *
 * The functions return counts so the calling cron-job can log progress
 * and trigger alerts if numbers look wrong.
 */

const PII_PLACEHOLDER_EMAIL = "scrubbed@retention.shelterdk.local";
const PII_PLACEHOLDER_NAME = "[anonymiseret]";
const PII_PLACEHOLDER_MESSAGE = "";

export interface RetentionRunResult {
  scrubbedCancelledBookings: number;
  scrubbedOldBookings: number;
  deletedContactMessages: number;
  deletedRejectedSubmissions: number;
  errors: string[];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Stringify any thrown value into a useful log line.
 * Supabase errors are plain objects with `.message` + `.code` (not Error
 * instances), so naive `String(err)` gives `[object Object]`.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [e.message, e.code, e.details, e.hint].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
    try {
      return JSON.stringify(err);
    } catch {
      return "[unserialisable error]";
    }
  }
  return String(err);
}

export async function runRetentionCleanup(): Promise<RetentionRunResult> {
  const supabase = createAdminClient();
  const result: RetentionRunResult = {
    scrubbedCancelledBookings: 0,
    scrubbedOldBookings: 0,
    deletedContactMessages: 0,
    deletedRejectedSubmissions: 0,
    errors: [],
  };

  // 1. Scrub cancelled/rejected bookings older than 90 days.
  try {
    const cutoff = daysAgoIso(90);
    const { data, error } = await supabase
      .from("shelter_bookings")
      .update({
        guest_email: PII_PLACEHOLDER_EMAIL,
        guest_name: PII_PLACEHOLDER_NAME,
        message: PII_PLACEHOLDER_MESSAGE,
      })
      .in("status", ["cancelled", "rejected"])
      .lt("updated_at", cutoff)
      .neq("guest_email", PII_PLACEHOLDER_EMAIL)
      .select("id");
    if (error) throw error;
    result.scrubbedCancelledBookings = data?.length ?? 0;
  } catch (err) {
    result.errors.push(`scrubbedCancelledBookings: ${describeError(err)}`);
  }

  // 2. Scrub confirmed/completed bookings older than 24 months.
  try {
    const cutoff = daysAgoIso(730);
    const { data, error } = await supabase
      .from("shelter_bookings")
      .update({
        guest_email: PII_PLACEHOLDER_EMAIL,
        guest_name: PII_PLACEHOLDER_NAME,
        message: PII_PLACEHOLDER_MESSAGE,
      })
      .eq("status", "confirmed")
      .lt("check_out", cutoff.slice(0, 10))
      .neq("guest_email", PII_PLACEHOLDER_EMAIL)
      .select("id");
    if (error) throw error;
    result.scrubbedOldBookings = data?.length ?? 0;
  } catch (err) {
    result.errors.push(`scrubbedOldBookings: ${describeError(err)}`);
  }

  // 3. Delete contact_messages older than 12 months.
  try {
    const cutoff = daysAgoIso(365);
    const { data, error } = await supabase
      .from("contact_messages")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    if (error) throw error;
    result.deletedContactMessages = data?.length ?? 0;
  } catch (err) {
    result.errors.push(`deletedContactMessages: ${describeError(err)}`);
  }

  // 4. Delete rejected community submissions older than 60 days.
  try {
    const cutoff = daysAgoIso(60);
    const { data, error } = await supabase
      .from("community_submissions")
      .delete()
      .eq("status", "rejected")
      .lt("updated_at", cutoff)
      .select("id");
    if (error) throw error;
    result.deletedRejectedSubmissions = data?.length ?? 0;
  } catch (err) {
    result.errors.push(`deletedRejectedSubmissions: ${describeError(err)}`);
  }

  // Note: newsletter_subscribers don't need retention cleanup here — the
  // unsubscribe API route hard-deletes rows immediately, so nothing
  // lingers past the retention window.

  return result;
}
