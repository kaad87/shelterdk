import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendOutreachEmail } from "@/lib/outreach-email";
import {
  buildShelterUrl,
  renderOutreachTemplate,
  DEFAULT_OUTREACH_TEMPLATE,
} from "@/lib/outreach-candidates";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

/**
 * POST /api/admin/outreach/test
 *
 * Sender en TESTMAIL af outreach-templaten til en valgt e-mail, så admin
 * kan se det faktiske HTML-output (ikke kun plain-text preview). Skriver
 * IKKE til outreach_review — ingen shelter markeres som kontaktet.
 *
 * Bruger den gemte template hvis tabellen findes, ellers den indbyggede
 * DEFAULT_OUTREACH_TEMPLATE (så test virker selv før migration).
 *
 * Body: { email: string, shelter_id?: string }
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const shelterId = typeof body.shelter_id === "string" ? body.shelter_id.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Ugyldig e-mailadresse" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Hent gemt template — fald tilbage til default hvis tabellen mangler.
  let template = DEFAULT_OUTREACH_TEMPLATE;
  const { data: tplRow } = await admin
    .from("outreach_templates")
    .select("subject, body")
    .eq("id", "default")
    .maybeSingle();
  if (tplRow?.subject && tplRow?.body) {
    template = { subject: tplRow.subject, body: tplRow.body };
  }

  // Brug et rigtigt shelter til realistiske værdier hvis muligt, ellers sample.
  let shelterTitle = "Eksempel Shelterplads";
  let recipientName = "Eksempel Kommune";
  let shelterUrl = `${SITE_ORIGIN}/shelter/eksempel-shelter`;

  if (shelterId) {
    const { data: shelter } = await admin
      .from("shelters")
      .select("id, title, slug, kommune")
      .eq("id", shelterId)
      .maybeSingle();
    if (shelter) {
      shelterTitle = shelter.title ?? shelterTitle;
      recipientName = shelter.kommune ? `${shelter.kommune} Kommune` : recipientName;
      shelterUrl = buildShelterUrl(
        { id: shelter.id, slug: shelter.slug ?? null } as Parameters<typeof buildShelterUrl>[0],
        SITE_ORIGIN
      );
    }
  }

  const rendered = renderOutreachTemplate(template, {
    shelter_title: shelterTitle,
    shelter_url: shelterUrl,
    recipient_name: recipientName,
  });

  try {
    await sendOutreachEmail({
      toEmail: email,
      subject: `[TEST] ${rendered.subject}`,
      body: rendered.body,
      shelterId: shelterId || null,
      skipBcc: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke sende testmail" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: email });
}
