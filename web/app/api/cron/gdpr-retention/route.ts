import { NextRequest, NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/gdpr-retention";

export const dynamic = "force-dynamic";

/**
 * GDPR retention cleanup endpoint.
 *
 * Protected by a shared secret (`CRON_SECRET` env var). Call via:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://shelterdk.dk/api/cron/gdpr-retention
 *
 * Schedule once per day via Vercel Cron, GitHub Actions, or any external
 * scheduler. Idempotent — safe to call multiple times.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (provided !== secret) {
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
