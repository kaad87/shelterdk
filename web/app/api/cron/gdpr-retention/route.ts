import { NextRequest, NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/gdpr-retention";

export const dynamic = "force-dynamic";

/**
 * GDPR retention cleanup endpoint.
 *
 * Protected by a shared secret (`CRON_SECRET` env var). Accepts either:
 *   - `x-cron-secret: $CRON_SECRET` header (used by Netlify Scheduled Function)
 *   - `Authorization: Bearer $CRON_SECRET` header (convenient for manual curl)
 *
 * Scheduled daily via `netlify/functions/gdpr-retention-cron.ts`.
 * Idempotent — safe to call multiple times.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const xCronSecret = req.headers.get("x-cron-secret") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (xCronSecret !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startedAt = new Date().toISOString();
  const result = await runRetentionCleanup();
  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    ...result,
  });
}
