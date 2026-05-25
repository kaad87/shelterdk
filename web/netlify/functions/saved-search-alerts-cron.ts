import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

/**
 * Netlify Scheduled Function — daglig saved-search alert cron.
 *
 * Triggers /api/cron/saved-search-alerts som finder nye shelters
 * matching gemte søgninger og sender alert-mail. Idempotent.
 *
 * Køres 08:00 UTC = 09:00/10:00 lokal tid (vinter/sommer) — godt
 * tidspunkt for at lande i indbakken før folk planlægger weekenden.
 */
const handler: Handler = async () => {
  try {
    const res = await fetch(
      `${process.env.URL}/api/cron/saved-search-alerts`,
      { headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } }
    );
    const body = await res.text();
    console.log("saved-search-alerts-cron result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("saved-search-alerts-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 8 * * *", handler);
