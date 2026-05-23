import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

/**
 * Netlify Scheduled Function — runs the GDPR retention cleanup once per day.
 *
 * Triggers /api/cron/gdpr-retention with the shared CRON_SECRET. The route
 * deletes / anonymises bookings + payments + tokens past their retention
 * window (see lib/gdpr-retention.ts). Idempotent — safe to retry.
 */
const handler: Handler = async () => {
  try {
    const res = await fetch(
      `${process.env.URL}/api/cron/gdpr-retention`,
      { headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } }
    );
    const body = await res.text();
    console.log("gdpr-retention-cron result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("gdpr-retention-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

// 03:00 UTC daily — efter expire-payments (02:00) så slettede bookings ses.
export default schedule("0 3 * * *", handler);
