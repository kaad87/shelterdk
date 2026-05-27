import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendOutreachEmail } from "@/lib/outreach-email";
import {
  buildShelterUrl,
  renderOutreachTemplate,
  type OutreachReviewStatus,
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

function clipString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

/**
 * POST /api/admin/outreach
 *
 * Sender outreach-mail og logger som "sent" i outreach_review. Bruger
 * den gemte template — body/subject sendes også med i payload så admin
 * kan overskrive til en specifik shelter hvis nødvendigt.
 *
 * Body: {
 *   shelter_id: string,
 *   recipient_email: string,
 *   recipient_name: string,
 *   subject?: string,         // override
 *   body?: string,            // override
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const shelterId = clipString(body.shelter_id, 64);
  const recipientEmail = clipString(body.recipient_email, 254);
  const recipientName = clipString(body.recipient_name, 120) ?? "";
  const subjectOverride = clipString(body.subject, 300);
  const bodyOverride = clipString(body.body, 20000);
  const notes = clipString(body.notes, 2000);

  if (!shelterId) {
    return NextResponse.json({ error: "shelter_id er påkrævet" }, { status: 400 });
  }
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "Ugyldig modtager-email" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Hent shelter + template
  const [shelterRes, templateRes] = await Promise.all([
    admin
      .from("shelters")
      .select("id, title, slug, kommune, region")
      .eq("id", shelterId)
      .single(),
    admin
      .from("outreach_templates")
      .select("subject, body")
      .eq("id", "default")
      .single(),
  ]);

  if (shelterRes.error || !shelterRes.data) {
    return NextResponse.json({ error: "Shelter findes ikke" }, { status: 404 });
  }
  if (templateRes.error || !templateRes.data) {
    return NextResponse.json({ error: "Outreach-template mangler" }, { status: 500 });
  }

  const shelter = shelterRes.data as { id: string; title: string; slug: string | null; kommune: string | null; region: string | null };
  const template = templateRes.data as { subject: string; body: string };

  const shelterUrl = buildShelterUrl(
    { id: shelter.id, slug: shelter.slug ?? null } as Parameters<typeof buildShelterUrl>[0],
    SITE_ORIGIN
  );

  // Render template (eller brug override hvis admin har redigeret)
  const rendered = renderOutreachTemplate(
    {
      subject: subjectOverride ?? template.subject,
      body: bodyOverride ?? template.body,
    },
    {
      shelter_title: shelter.title,
      shelter_url: shelterUrl,
      recipient_name: recipientName || (shelter.kommune ? `${shelter.kommune} Kommune` : "Hej"),
    }
  );

  // Send mail
  try {
    await sendOutreachEmail({
      toEmail: recipientEmail,
      subject: rendered.subject,
      body: rendered.body,
      shelterId: shelter.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunne ikke sende mail" },
      { status: 500 }
    );
  }

  // Log som "sent" i outreach_review (upsert)
  const nowIso = new Date().toISOString();
  const { error: reviewErr } = await admin
    .from("outreach_review")
    .upsert({
      shelter_id: shelter.id,
      status: "sent" satisfies OutreachReviewStatus,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      notes,
      sent_at: nowIso,
      reviewed_at: nowIso,
    });
  if (reviewErr) {
    return NextResponse.json(
      { ok: true, warning: `Mail sendt, men kunne ikke logge status: ${reviewErr.message}` },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, sentAt: nowIso });
}

/**
 * PATCH /api/admin/outreach
 *
 * Opdater status for en kandidat uden at sende mail. Bruges til
 * "Skip" / "Markér som besvaret" / "Markér som ikke relevant".
 *
 * Body: { shelter_id, status, notes? }
 */
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const shelterId = clipString(body.shelter_id, 64);
  const status = clipString(body.status, 32);
  const notes = clipString(body.notes, 2000);
  const validStatuses: OutreachReviewStatus[] = ["sent", "replied", "not_relevant", "needs_research"];

  if (!shelterId || !status || !validStatuses.includes(status as OutreachReviewStatus)) {
    return NextResponse.json({ error: "shelter_id og gyldig status er påkrævet" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("outreach_review")
    .upsert({
      shelter_id: shelterId,
      status,
      notes,
      reviewed_at: new Date().toISOString(),
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
