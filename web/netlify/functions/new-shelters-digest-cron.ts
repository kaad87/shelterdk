import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

/**
 * Netlify Scheduled Function — ugentligt "nye shelters"-digest.
 *
 * Triggers /api/cron/new-shelters-digest som sender ugens nye shelters til
 * alle nyhedsbrev-abonnenter. Springer over hvis ingen nye shelters.
 *
 * Køres torsdag 08:00 UTC (= 09:00/10:00 lokal vinter/sommer) — lander i
 * indbakken før folk planlægger weekenden.
 */
const handler: Handler = async () => {
  try {
    const res = await fetch(`${process.env.URL}/api/cron/new-shelters-digest`, {
      headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
    });
    const body = await res.text();
    console.log("new-shelters-digest-cron result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("new-shelters-digest-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 8 * * 4", handler); // torsdag 08:00 UTC
