import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

const handler: Handler = async () => {
  try {
    const res = await fetch(
      `${process.env.URL}/api/cron/ical-sync`,
      { headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } }
    );
    const body = await res.text();
    console.log("ical-sync-cron result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ical-sync-cron failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 * * * *", handler); // every hour on the hour
