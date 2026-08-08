import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendOwnerPortalInviteEmail } from "@/lib/email";
import { createOwnerClaimToken } from "@/lib/owner-claim";
import { parseNotifyEmailsInput } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getOwnerPortalSignupUrl(req: NextRequest, claimToken: string, ownerEmail: string): string {
  const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shelterdk.dk";
  const url = new URL("/ejer/signup", origin);
  url.searchParams.set("claim", claimToken);
  url.searchParams.set("email", ownerEmail);
  return url.toString();
}

function getOwnerPortalLoginUrl(req: NextRequest, claimToken: string, ownerEmail: string): string {
  const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shelterdk.dk";
  const url = new URL("/ejer/login", origin);
  url.searchParams.set("email", ownerEmail);
  url.searchParams.set("next", `/ejer/claim?claim=${encodeURIComponent(claimToken)}`);
  return url.toString();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("bookable_shelters")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shelters: data });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { slug, title, owner_email, max_persons, description, shelter_id, booking_mode, payment_mode, shelter_price_dkk, platform_fee_pct, platform_fee_min_dkk } = body;

  if (!slug || !title || !owner_email)
    return NextResponse.json(
      { error: "slug, title og owner_email er påkrævet" },
      { status: 400 }
    );

  const { data, error } = await createAdminClient()
    .from("bookable_shelters")
    .insert({
      slug: slug.trim().toLowerCase(),
      title: title.trim(),
      owner_email: owner_email.trim().toLowerCase(),
      max_persons: (Number.isInteger(Number(max_persons)) && Number(max_persons) > 0) ? Number(max_persons) : 6,
      description: description?.trim() || null,
      shelter_id: shelter_id || null,
      booking_mode: (["shelterdk", "iframe", "both"] as const).includes(booking_mode) ? booking_mode : "iframe",
      payment_mode: payment_mode === "upfront" ? "upfront" : "after_confirmation",
      shelter_price_dkk: shelter_price_dkk ? Number(shelter_price_dkk) : null,
      platform_fee_pct: platform_fee_pct != null ? Number(platform_fee_pct) : 5,
      platform_fee_min_dkk: platform_fee_min_dkk != null ? Number(platform_fee_min_dkk) : 25,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message.includes("unique")
      ? `Slug "${slug}" er allerede i brug`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ shelter: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id påkrævet" }, { status: 400 });

  await createAdminClient().from("bookable_shelters").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id || !action) {
    return NextResponse.json({ error: "id og action er påkrævet" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: shelter, error: shelterError } = await admin
    .from("bookable_shelters")
    .select("*")
    .eq("id", id)
    .single();

  if (shelterError || !shelter) {
    return NextResponse.json({ error: "Shelter ikke fundet" }, { status: 404 });
  }

  if (action === "update_owner_email") {
    const ownerEmail = normalizeEmail((body as { owner_email?: unknown }).owner_email);
    if (!ownerEmail || !isValidEmail(ownerEmail)) {
      return NextResponse.json({ error: "Gyldig owner_email er påkrævet" }, { status: 400 });
    }
    const nextFields: Record<string, string | null> = { owner_email: ownerEmail };
    if (ownerEmail !== shelter.owner_email?.trim().toLowerCase()) {
      nextFields.auth_user_id = null;
    }
    const { data, error } = await admin
      .from("bookable_shelters")
      .update(nextFields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, shelter: data });
  }

  if (action === "update_notify_emails") {
    // Ekstra modtagere af bookingnotifikationer. Holdes bevidst adskilt fra
    // owner_email: dét felt er identitetsnøgle, og at ændre det nulstiller
    // auth_user_id og kobler ejerens login fra (se update_owner_email ovenfor).
    const { emails, invalid } = parseNotifyEmailsInput(
      (body as { notify_emails?: unknown }).notify_emails,
      shelter.owner_email ?? ""
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Ugyldig email: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
    const { data, error } = await admin
      .from("bookable_shelters")
      .update({ notify_emails: emails.length > 0 ? emails : null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, shelter: data });
  }

  if (action === "update_payment_settings") {
    const bodyWithSettings = body as {
      payment_mode?: unknown;
      shelter_price_dkk?: unknown;
      platform_fee_pct?: unknown;
      platform_fee_min_dkk?: unknown;
    };

    const paymentMode =
      bodyWithSettings.payment_mode === "upfront" ? "upfront" : "after_confirmation";
    const rawPrice = bodyWithSettings.shelter_price_dkk;
    const shelterPriceDkk =
      rawPrice === null || rawPrice === "" || rawPrice === undefined ? null : Number(rawPrice);
    const feePct = Number(bodyWithSettings.platform_fee_pct);
    const feeMinDkk = Number(bodyWithSettings.platform_fee_min_dkk);

    if (shelterPriceDkk !== null && (Number.isNaN(shelterPriceDkk) || shelterPriceDkk < 0)) {
      return NextResponse.json({ error: "Ugyldig pris" }, { status: 400 });
    }
    if (Number.isNaN(feePct) || feePct < 0 || feePct > 100) {
      return NextResponse.json({ error: "Ugyldigt transaktionsgebyr" }, { status: 400 });
    }
    if (Number.isNaN(feeMinDkk) || feeMinDkk < 0) {
      return NextResponse.json({ error: "Ugyldigt minimumsgebyr" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("bookable_shelters")
      .update({
        payment_mode: paymentMode,
        shelter_price_dkk: shelterPriceDkk,
        platform_fee_pct: feePct,
        platform_fee_min_dkk: feeMinDkk,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, shelter: data });
  }

  if (action === "link_existing_user") {
    return NextResponse.json(
      { error: "Direkte linking er deaktiveret — brug invite-flowet, så ejeren selv accepterer tilknytningen" },
      { status: 409 }
    );
  }

  if (action === "unlink_owner") {
    const { data, error } = await admin
      .from("bookable_shelters")
      .update({ auth_user_id: null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, shelter: data });
  }

  if (action === "send_invite") {
    const ownerEmail = normalizeEmail(shelter.owner_email);
    if (!ownerEmail || !isValidEmail(ownerEmail)) {
      return NextResponse.json({ error: "Shelteret mangler en gyldig ejer-email" }, { status: 400 });
    }
    const claim = await createOwnerClaimToken(shelter.id, ownerEmail);
    const signupUrl = getOwnerPortalSignupUrl(req, claim.token, ownerEmail);
    const loginUrl = getOwnerPortalLoginUrl(req, claim.token, ownerEmail);
    try {
      await sendOwnerPortalInviteEmail({
        toEmail: ownerEmail,
        shelterTitle: shelter.title,
        signupUrl,
        loginUrl,
        shelterId: shelter.id,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Kunne ikke sende invite" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, signupUrl, loginUrl, expiresAt: claim.expires_at });
  }

  return NextResponse.json({ error: "Ukendt action" }, { status: 400 });
}
