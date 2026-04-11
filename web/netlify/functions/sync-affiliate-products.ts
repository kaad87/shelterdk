import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";
import { runSync } from "../../scripts/sync-affiliate-products";

// Cron: 03:00 UTC daily (≈ 04:00 DK winter, 05:00 DK summer)
const handler: Handler = async () => {
  try {
    await runSync();
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sync failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 3 * * *", handler);
