import { NextRequest, NextResponse } from "next/server";
import { sendLoggedEmail } from "@/lib/email";
import { getNewShelters } from "@/lib/new-shelters";
import { buildNewSheltersDigest, siteOrigin } from "@/lib/new-shelters-email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGEST_WINDOW_DAYS = 7;
const DIGEST_MAX_SHELTERS = 12;

/**
 * POST /api/admin/new-shelters-digest-test
 *
 * Sender "nye shelters"-ugebrevet som TESTMAIL til én adresse. Rører ikke
 * newsletter_subscribers. Beskyttet med ADMIN_SECRET (x-admin-secret).
 *
 * Body: { email: string }
 *
 * Indhold: samme som det rigtige ugebrev (sidste 7 dages præsentable shelters).
 * Er der ingen i 7-dages-vinduet, falder den tilbage til de nyeste præsentable,
 * så skabelonen altid kan ses. Responsen angiver hvilken tilstand der blev brugt.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Indtast en gyldig email-adresse." }, { status: 400 });
  }

  const origin = siteOrigin();

  // Samme indhold som det rigtige ugebrev: sidste 7 dage.
  let shelters = await getNewShelters({
    sinceDays: DIGEST_WINDOW_DAYS,
    limit: DIGEST_MAX_SHELTERS,
    presentableOnly: true,
  });
  let usedFallback = false;
  if (shelters.length === 0) {
    // Ingen nye i vinduet → vis de nyeste præsentable, så skabelonen kan ses.
    shelters = await getNewShelters({ limit: DIGEST_MAX_SHELTERS, presentableOnly: true });
    usedFallback = true;
  }

  if (shelters.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "Ingen præsentable shelters at vise endnu." },
      { status: 200 }
    );
  }

  const unsubscribeUrl = `${origin}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
  const digest = buildNewSheltersDigest(shelters, { unsubscribeUrl, origin });
  if (!digest) {
    return NextResponse.json({ ok: false, reason: "Kunne ikke bygge digest." }, { status: 200 });
  }

  try {
    await sendLoggedEmail({
      to: email,
      subject: `[TEST] ${digest.subject}`,
      html: digest.html,
      text: digest.text,
      unsubscribeUrl,
      context: {
        category: "newsletter",
        emailType: "new_shelters_digest_test",
        metadata: { test: true, shelterCount: shelters.length, usedFallback },
      },
    });
  } catch (err) {
    console.error("new-shelters-digest-test: send failed", err);
    const msg = err instanceof Error ? err.message : "Send fejlede";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sentTo: email,
    shelterCount: shelters.length,
    usedFallback,
  });
}
