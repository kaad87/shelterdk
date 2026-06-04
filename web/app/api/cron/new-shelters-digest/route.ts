import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendLoggedEmail } from "@/lib/email";
import { getNewShelters } from "@/lib/new-shelters";
import { buildNewSheltersDigest, siteOrigin } from "@/lib/new-shelters-email";

export const dynamic = "force-dynamic";

/**
 * "Ugens nye shelters"-digest. Generelt nyhedsbrev til alle abonnenter.
 *
 * Beskyttet med CRON_SECRET. Henter de seneste 7 dages præsentable nye
 * shelters (cap 12) og sender én mail pr. abonnent med personligt
 * afmeldings-link. Springer helt over hvis der ingen nye shelters er.
 *
 * Scheduled via netlify/functions/new-shelters-digest-cron.ts (torsdag 08:00 UTC).
 */

const DIGEST_WINDOW_DAYS = 7;
const DIGEST_MAX_SHELTERS = 12;
const SUBSCRIBER_LIMIT = 5000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const xCron = req.headers.get("x-cron-secret") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (xCron !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startedAt = new Date().toISOString();
  const origin = siteOrigin();

  const shelters = await getNewShelters({
    sinceDays: DIGEST_WINDOW_DAYS,
    limit: DIGEST_MAX_SHELTERS,
    presentableOnly: true,
  });

  if (shelters.length === 0) {
    return NextResponse.json({ startedAt, skipped: true, reason: "no new shelters", sent: 0 });
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("newsletter_subscribers")
    .select("email")
    .limit(SUBSCRIBER_LIMIT);

  if (error) {
    console.error("new-shelters-digest: subscriber list failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const emails = Array.from(
    new Set(
      (subs ?? [])
        .map((s) => (s.email ?? "").trim().toLowerCase())
        .filter((e) => e.length > 0)
    )
  );

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const unsubscribeUrl = `${origin}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
      const digest = buildNewSheltersDigest(shelters, { unsubscribeUrl, origin });
      if (!digest) break; // shelters tomt — bør ikke ske her
      await sendLoggedEmail({
        to: email,
        subject: digest.subject,
        html: digest.html,
        text: digest.text,
        unsubscribeUrl,
        context: {
          category: "newsletter",
          emailType: "new_shelters_digest",
          metadata: { shelterCount: shelters.length },
        },
      });
      sent += 1;
    } catch (err) {
      console.error("new-shelters-digest: send failed for", email, err);
      failed += 1;
    }
  }

  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    shelterCount: shelters.length,
    subscribers: emails.length,
    sent,
    failed,
  });
}
