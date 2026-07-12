import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";

// Let job (typisk 0-5 mails/dag) — fint inden for Netlify-funktions-timeout,
// i modsætning til de tunge syncs der er flyttet til GitHub Actions.
const handler: Handler = async () => {
  try {
    const res = await fetch(`${process.env.URL}/api/cron/post-stay-reviews`, {
      headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
    });
    const body = await res.text();
    console.log("post-stay-reviews result:", body);
    return { statusCode: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("post-stay-reviews failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

// 07:00 UTC ≈ 09:00 DK sommer — dagen efter check-out.
export default schedule("0 7 * * *", handler);
