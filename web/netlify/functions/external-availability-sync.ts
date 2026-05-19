import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

const handler: Handler = async () => {
  try {
    const res = await fetch(
      `${process.env.URL}/api/cron/external-availability-sync`,
      {
        headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
      }
    );
    const body = await res.text();
    console.log("external-availability-sync result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("external-availability-sync failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

// Netlify cron uses UTC. This maps to 08:00, 12:00, 16:00, 20:00 in CEST
// and 07:00, 11:00, 15:00, 19:00 in CET.
export default schedule("0 6,10,14,18 * * *", handler);
