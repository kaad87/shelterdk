import { sendLoggedEmail, escapeHtml, renderEmail, renderEmailText } from "./email";
import { calculateVatIncludedBreakdown } from "./stripe";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function bookingLink(guestToken: string): string {
  return `${SITE_URL}/min-booking/${guestToken}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Modtagere af en ejer-notifikation: ejerens egen adresse plus eventuelle ekstra
 * adresser fra `bookable_shelters.notify_emails`.
 *
 * `owner_email` er identitetsnøgle (login, ejer-claim, admin-opslag slår op med
 * lighed på den), så ekstra modtagere må ALDRIG lægges ind i det felt — de bor i
 * en separat kolonne og samles først her, ved afsendelsen.
 *
 * Normaliserer og dedupliker, så samme adresse i begge felter kun giver én mail.
 * `sendLoggedEmail` tager sig af suppression-filtrering og logning pr. modtager.
 */
export function ownerRecipients(
  ownerEmail: string,
  notifyEmails?: string[] | null
): string[] {
  const seen = new Set<string>();
  for (const raw of [ownerEmail, ...(notifyEmails ?? [])]) {
    const e = (raw ?? "").trim().toLowerCase();
    if (e && EMAIL_RE.test(e)) seen.add(e);
  }
  return [...seen];
}

/**
 * Parser admin-feltet "Ekstra notifikationsmails" (komma/semikolon/linjeskift).
 *
 * Returnerer `{ emails, invalid }` så kaldestedet kan afvise med en brugbar fejl
 * i stedet for stille at smide adresser væk — en tabt adresse her betyder at en
 * ejer aldrig får sine bookingnotifikationer.
 *
 * Ejerens egen adresse frasorteres: den er allerede modtager via `owner_email`,
 * og at have den i begge felter ville ellers ligne en dublet i admin-fladen.
 */
export function parseNotifyEmailsInput(
  raw: unknown,
  ownerEmail: string
): { emails: string[]; invalid: string[] } {
  const parts =
    typeof raw === "string" ? raw.split(/[,;\n]/) : Array.isArray(raw) ? raw : [];
  const owner = (ownerEmail ?? "").trim().toLowerCase();
  const emails = new Set<string>();
  const invalid: string[] = [];
  for (const part of parts) {
    const e = typeof part === "string" ? part.trim().toLowerCase() : "";
    if (!e) continue;
    if (!EMAIL_RE.test(e)) {
      invalid.push(e);
      continue;
    }
    if (e === owner) continue;
    emails.add(e);
  }
  return { emails: [...emails], invalid };
}

function bookingNotificationRecipients(): string[] {
  const raw =
    process.env.BOOKING_NOTIFICATION_EMAIL?.trim() ||
    process.env.BOOKING_ALERT_EMAIL?.trim() ||
    "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function bookingReference(bookingId?: string | null): string | null {
  if (!bookingId) return null;
  return `BK-${bookingId.slice(0, 8).toUpperCase()}`;
}

// ─── Placeholder replacement ─────────────────────────────────────────────────

export interface AutoMessageContext {
  guestName: string;
  shelterTitle: string;
  checkIn: string;  // ISO date "YYYY-MM-DD"
  checkOut: string; // ISO date "YYYY-MM-DD"
  guestCount: number;
}

/**
 * Replace placeholders in an owner-written template.
 * All dynamic values are HTML-escaped so this output is safe to embed in HTML.
 * Unknown placeholders are left as-is (spec: "ignoreres").
 */
export function applyMessagePlaceholders(
  template: string,
  ctx: AutoMessageContext
): string {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(ctx.checkOut).getTime() - new Date(ctx.checkIn).getTime()) /
        86_400_000
    )
  );

  function fmtDa(iso: string): string {
    return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
      weekday: "short",
      day: "numeric",
      month: "long",
    });
  }

  return template
    .replace(/{gæst_navn}/g, escapeHtml(ctx.guestName))
    .replace(/{shelter_navn}/g, escapeHtml(ctx.shelterTitle))
    .replace(/{ankomst_dato}/g, escapeHtml(fmtDa(ctx.checkIn)))
    .replace(/{afrejse_dato}/g, escapeHtml(fmtDa(ctx.checkOut)))
    .replace(/{antal_nætter}/g, String(nights))
    .replace(/{antal_personer}/g, String(ctx.guestCount));
}

/**
 * Send an owner-authored auto-message to a guest.
 * Subject is plain text (no HTML escaping). Body is HTML.
 * Throws on Resend error — caller must wrap in try/catch.
 */
export async function sendBookingAutoMessage(opts: {
  guestEmail: string;
  subject: string; // raw owner template
  body: string;    // raw owner template
  ctx: AutoMessageContext;
  bookingId?: string;
  shelterId?: string;
}) {
  // Subject: plain text — replace with raw values (no HTML entities in email subjects)
  function replacePlain(template: string): string {
    const nights = Math.max(
      1,
      Math.round(
        (new Date(opts.ctx.checkOut).getTime() - new Date(opts.ctx.checkIn).getTime()) /
          86_400_000
      )
    );
    function fmtDa(iso: string): string {
      return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    }
    return template
      .replace(/{gæst_navn}/g, opts.ctx.guestName)
      .replace(/{shelter_navn}/g, opts.ctx.shelterTitle)
      .replace(/{ankomst_dato}/g, fmtDa(opts.ctx.checkIn))
      .replace(/{afrejse_dato}/g, fmtDa(opts.ctx.checkOut))
      .replace(/{antal_nætter}/g, String(nights))
      .replace(/{antal_personer}/g, String(opts.ctx.guestCount));
  }

  const subject = replacePlain(opts.subject);

  // Body: HTML — escape the owner's free text first (XSS prevention),
  // then replace placeholders with HTML-escaped values via applyMessagePlaceholders.
  // Note: owner text containing "&" will appear as "&amp;" in the rendered email.
  // This is the correct tradeoff: owner-written content is untrusted input.
  const bodyHtml = applyMessagePlaceholders(escapeHtml(opts.body), opts.ctx).replace(/\n/g, "<br>");
  const bodyPlain = replacePlain(opts.body);

  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html: renderEmail({
        title: subject,
        bodyHtml: `<p style="font-size:13px;color:#333;line-height:1.65;">${bodyHtml}</p>`,
      }),
      text: renderEmailText({
        title: subject,
        lines: [bodyPlain],
      }),
      context: {
        emailType: "booking_auto_message",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        metadata: {
          guestName: opts.ctx.guestName,
          shelterTitle: opts.ctx.shelterTitle,
          checkIn: opts.ctx.checkIn,
          checkOut: opts.ctx.checkOut,
        },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (auto-besked): " + (error instanceof Error ? error.message : String(error)));
  }
}

function esc(s: string): string {
  return escapeHtml(s);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/** Til ejeren: ny bookingforespørgsel med accept/afvis-links */
export async function sendBookingRequestToOwner(opts: {
  ownerEmail: string;
  /** Ekstra modtagere fra bookable_shelters.notify_emails. */
  notifyEmails?: string[] | null;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  message: string | null;
  confirmToken: string;
  rejectToken: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const confirmUrl = `${SITE_URL}/api/booking/action/${opts.confirmToken}`;
  const rejectUrl = `${SITE_URL}/api/booking/action/${opts.rejectToken}`;
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const messageBlock = opts.message
    ? `<div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Besked fra gæst</p>
        <p style="font-size:13px;color:#555;margin:0;">${esc(opts.message)}</p>
      </div>`
    : "";

  const subject = `Ny bookingforespørgsel til ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
    title: "Ny bookingforespørgsel",
    preheader: `${opts.guestName} ønsker at booke ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) ønsker at booke <strong>${esc(opts.shelterTitle)}</strong>.</p>
      <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer · ${opts.guestCount} person${opts.guestCount !== 1 ? "er" : ""}</p>
        <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
      </div>
      ${messageBlock}
      <div style="margin:20px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;margin-right:8px;">✓ Acceptér booking</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">✗ Afvis booking</a>
      </div>
      <p style="font-size:12px;color:#999;margin:0;">Eller administrér via dit <a href="${dashboardUrl}" style="color:#c5a059;">dashboard</a>. Linkene udløber om 7 dage.</p>
    `,
  });
  const text = renderEmailText({
    title: "Ny bookingforespørgsel",
    lines: [
      `${opts.guestName} (${opts.guestEmail}) ønsker at booke ${opts.shelterTitle}.`,
      `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)} · ${opts.guestCount} person${opts.guestCount !== 1 ? "er" : ""}`,
      ...(opts.message ? [`Besked: ${opts.message}`] : []),
      `Acceptér: ${confirmUrl}`,
      `Afvis: ${rejectUrl}`,
    ],
    url: dashboardUrl,
  });
  try {
    await sendLoggedEmail({
      to: ownerRecipients(opts.ownerEmail, opts.notifyEmails),
      subject,
      html,
      text,
      context: {
        emailType: "booking_request_owner",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        metadata: { guestEmail: opts.guestEmail, guestCount: opts.guestCount },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (ejer forespørgsel): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: bekræftelse på at forespørgsel er modtaget */
export async function sendBookingReceivedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  guestToken: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const subject = `Vi har modtaget din forespørgsel til ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
    title: "Forespørgsel modtaget",
    preheader: `Din forespørgsel til ${opts.shelterTitle} er modtaget. Ejeren vender tilbage hurtigst muligt.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Vi har modtaget din bookingforespørgsel til <strong>${esc(opts.shelterTitle)}</strong>.</p>
      <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
        <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
      </div>
      <p style="font-size:13px;color:#666;margin:0 0 16px;line-height:1.5;">Ejeren vender tilbage hurtigst muligt. Du kan allerede nu se din booking og trække forespørgslen tilbage, hvis du fortryder.</p>
      <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se din booking på ShelterDK</a>
      <p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser din booking direkte.</p>
    `,
  });
  const text = renderEmailText({
    title: "Forespørgsel modtaget",
    lines: [
      `Hej ${opts.guestName}! Vi har modtaget din bookingforespørgsel til ${opts.shelterTitle}.`,
      `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
      "Ejeren vender tilbage hurtigst muligt. Du kan allerede nu se din booking og trække forespørgslen tilbage, hvis du fortryder.",
    ],
    url: bookingLink(opts.guestToken),
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "booking_received_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (gæst modtaget): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: booking bekræftet */
export async function sendBookingConfirmedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  guestToken: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const subject = `Din booking er bekræftet!`;
  const reference = bookingReference(opts.bookingId);
  const html = renderEmail({
    title: "Din booking er bekræftet!",
    preheader: `Din booking af ${opts.shelterTitle} er bekræftet. God tur!`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Din booking af <strong>${esc(opts.shelterTitle)}</strong> er nu bekræftet.</p>
      <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Bekræftet ophold</p>
        <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
      </div>
      ${reference ? `<p style="font-size:12px;color:#666;margin:0 0 8px;"><strong>Bookingreference:</strong> ${esc(reference)}</p>` : ""}
      <p style="font-size:13px;color:#666;margin:0 0 16px;">God tur! Denne e-mail og din bookingside kan bruges som bookingbevis ved ankomst.</p>
      <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se din booking på ShelterDK</a>
      <p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser din booking direkte. Vis siden eller denne mail ved ankomst.</p>
    `,
  });
  const text = renderEmailText({
    title: "Din booking er bekræftet!",
    lines: [
      `Hej ${opts.guestName}! Din booking af ${opts.shelterTitle} er nu bekræftet.`,
      `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
      ...(reference ? [`Bookingreference: ${reference}`] : []),
      "Denne e-mail og din bookingside kan bruges som bookingbevis ved ankomst.",
      "God tur!",
    ],
    url: bookingLink(opts.guestToken),
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "booking_confirmed_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (gæst bekræftet): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: booking afvist */
export async function sendBookingRejectedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const subject = `Din bookingforespørgsel til ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
    title: "Forespørgsel ikke imødekommet",
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
      <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 16px;">Desværre kunne ejeren ikke imødekomme din forespørgsel til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
      <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
    `,
  });
  const text = renderEmailText({
    title: "Forespørgsel ikke imødekommet",
    lines: [
      `Hej ${opts.guestName},`,
      `Desværre kunne ejeren ikke imødekomme din forespørgsel til ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
      "Find andre shelters på shelterdk.dk",
    ],
    url: "https://shelterdk.dk/soeg",
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "booking_rejected_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (gæst afvist): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: betalingslink efter ejerens bekræftelse */
export async function sendPaymentRequestToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  amountShelterDkk: number;
  amountPlatformDkk: number;
  paymentUrl: string;
  guestToken: string;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const { vatDkk } = calculateVatIncludedBreakdown(opts.amountPlatformDkk);
  const bookingUrl = bookingLink(opts.guestToken);
  const overnatningRow = opts.amountShelterDkk > 0
    ? `<tr><td style="font-size:12px;color:#666;padding:4px 0;">Overnatning</td><td style="font-size:12px;text-align:right;padding:4px 0;">${opts.amountShelterDkk} kr</td></tr>`
    : "";
  const subject = `Betal din booking af ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
    title: "Din booking er klar til betaling",
    preheader: `Betal inden 24 timer for at bekræfte din booking af ${opts.shelterTitle}.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Ejeren har bekræftet din booking af <strong>${esc(opts.shelterTitle)}</strong>.</p>
      <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
        <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        ${overnatningRow}
        <tr><td style="font-size:12px;color:#666;padding:4px 0;">Administrationsgebyr inkl. moms</td><td style="font-size:12px;text-align:right;padding:4px 0;">${opts.amountPlatformDkk} kr</td></tr>
        <tr style="border-top:1px solid #e5e1d8;"><td style="font-size:13px;font-weight:600;color:#2C3E50;padding:6px 0;">I alt</td><td style="font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${opts.amountTotalDkk} kr</td></tr>
      </table>
      <p style="font-size:12px;color:#999;margin:0 0 8px;">Heraf ${vatDkk.toFixed(2).replace(".", ",")} kr moms.</p>
      <p style="font-size:12px;color:#999;margin:0 0 16px;">Betalingslinket udløber om 24 timer. Hvis du afbryder betalingen eller dit kort fejler, kan du altid fortsætte via din booking.</p>
      <a href="${opts.paymentUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Betal nu via MobilePay</a>
      <p style="font-size:12px;color:#999;margin:12px 0 0;">Du kan også åbne din booking her: <a href="${bookingUrl}" style="color:#c5a059;">${bookingUrl}</a></p>
    `,
  });
  const text = renderEmailText({
    title: "Din booking er klar til betaling",
    lines: [
      `Hej ${opts.guestName}! Ejeren har bekræftet din booking af ${opts.shelterTitle}.`,
      `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
      `I alt: ${opts.amountTotalDkk} kr (heraf ${opts.amountPlatformDkk} kr administrationsgebyr inkl. moms).`,
      `Momsandel i gebyret: ${vatDkk.toFixed(2).replace(".", ",")} kr.`,
      "Betalingslinket udløber om 24 timer.",
      "Hvis du afbryder betalingen eller dit kort fejler, kan du fortsætte via din booking.",
    ],
    url: bookingUrl,
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "payment_request_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: {
          amountTotalDkk: opts.amountTotalDkk,
          amountShelterDkk: opts.amountShelterDkk,
          amountPlatformDkk: opts.amountPlatformDkk,
        },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (gæst betaling): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: upfront-booking oprettet, betaling mangler stadig */
export async function sendUpfrontPaymentLinkToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  amountShelterDkk: number;
  amountPlatformDkk: number;
  paymentUrl: string;
  guestToken: string;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const { vatDkk } = calculateVatIncludedBreakdown(opts.amountPlatformDkk);
  const bookingUrl = bookingLink(opts.guestToken);
  const overnatningRow = opts.amountShelterDkk > 0
    ? `<tr><td style="font-size:12px;color:#666;padding:4px 0;">Overnatning</td><td style="font-size:12px;text-align:right;padding:4px 0;">${opts.amountShelterDkk} kr</td></tr>`
    : "";
  const subject = `Fuldfør betalingen for din booking af ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
    title: "Din booking afventer betaling",
    preheader: `Betal inden 24 timer for at sikre din booking af ${opts.shelterTitle}.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Din booking af <strong>${esc(opts.shelterTitle)}</strong> er oprettet og venter nu på betaling.</p>
      <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
        <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        ${overnatningRow}
        <tr><td style="font-size:12px;color:#666;padding:4px 0;">Administrationsgebyr inkl. moms</td><td style="font-size:12px;text-align:right;padding:4px 0;">${opts.amountPlatformDkk} kr</td></tr>
        <tr style="border-top:1px solid #e5e1d8;"><td style="font-size:13px;font-weight:600;color:#2C3E50;padding:6px 0;">I alt</td><td style="font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${opts.amountTotalDkk} kr</td></tr>
      </table>
      <p style="font-size:12px;color:#999;margin:0 0 8px;">Heraf ${vatDkk.toFixed(2).replace(".", ",")} kr moms.</p>
      <p style="font-size:12px;color:#999;margin:0 0 16px;">Betal inden 24 timer for at sikre dine datoer. Hvis du afbryder betalingen eller dit kort fejler, kan du fortsætte via din booking.</p>
      <a href="${opts.paymentUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Betal nu via MobilePay</a>
      <p style="font-size:12px;color:#999;margin:12px 0 0;">Du kan også åbne din booking her: <a href="${bookingUrl}" style="color:#c5a059;">${bookingUrl}</a></p>
    `,
  });
  const text = renderEmailText({
    title: "Din booking afventer betaling",
    lines: [
      `Hej ${opts.guestName}! Din booking af ${opts.shelterTitle} er oprettet og venter nu på betaling.`,
      `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
      `I alt: ${opts.amountTotalDkk} kr (heraf ${opts.amountPlatformDkk} kr administrationsgebyr inkl. moms).`,
      `Momsandel i gebyret: ${vatDkk.toFixed(2).replace(".", ",")} kr.`,
      "Betal inden 24 timer for at sikre dine datoer.",
      "Hvis du afbryder betalingen eller dit kort fejler, kan du fortsætte via din booking.",
    ],
    url: bookingUrl,
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "upfront_payment_link_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: {
          amountTotalDkk: opts.amountTotalDkk,
          amountShelterDkk: opts.amountShelterDkk,
          amountPlatformDkk: opts.amountPlatformDkk,
        },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (upfront betalingslink): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæst + ejer: betaling gennemført */
export async function sendPaymentConfirmed(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  /** Ekstra modtagere fra bookable_shelters.notify_emails. */
  notifyEmails?: string[] | null;
  ownerToken?: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  guestToken: string;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const reference = bookingReference(opts.bookingId);
  const notifyRecipients = bookingNotificationRecipients();
  const notificationPromise =
    notifyRecipients.length > 0
      ? sendLoggedEmail({
          to: notifyRecipients,
          subject: `Ny booking: ${esc(opts.shelterTitle)} (${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)})`,
          html: renderEmail({
            title: "Ny booking på ShelterDK",
            preheader: `${opts.guestName} har booket ${opts.shelterTitle} for ${opts.amountTotalDkk} kr.`,
            bodyHtml: `
              <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) har gennemført en booking på <strong>${esc(opts.shelterTitle)}</strong>.</p>
              <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
                <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Bekræftet ophold</p>
                <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0 0 2px;">${esc(opts.shelterTitle)}</p>
                <p style="font-size:12px;color:#666;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
              </div>
              ${reference ? `<p style="font-size:12px;color:#666;margin:0 0 8px;"><strong>Bookingreference:</strong> ${esc(reference)}</p>` : ""}
              <p style="font-size:12px;color:#666;margin:0 0 4px;"><strong>Betalt:</strong> ${opts.amountTotalDkk} kr</p>
              <p style="font-size:12px;color:#666;margin:0 0 16px;"><strong>Ejer:</strong> ${esc(opts.ownerEmail)}</p>
              <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Åbn booking på ShelterDK</a>
            `,
          }),
          text: renderEmailText({
            title: "Ny booking på ShelterDK",
            lines: [
              `${opts.guestName} (${opts.guestEmail}) har booket ${opts.shelterTitle}.`,
              `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
              `Betalt: ${opts.amountTotalDkk} kr`,
              `Ejer: ${opts.ownerEmail}`,
              ...(reference ? [`Bookingreference: ${reference}`] : []),
            ],
            url: bookingLink(opts.guestToken),
          }),
          context: {
            category: "monitor",
            emailType: "booking_confirmed_internal",
            bookingId: opts.bookingId ?? null,
            shelterId: opts.shelterId ?? null,
            paymentId: opts.paymentId ?? null,
            metadata: { amountTotalDkk: opts.amountTotalDkk, ownerEmail: opts.ownerEmail },
          },
        })
      : Promise.resolve();

  const [guestResult, ownerResult, notificationResult] = await Promise.allSettled([
    sendLoggedEmail({
      to: opts.guestEmail,
      subject: "Betaling modtaget – booking bekræftet!",
      html: renderEmail({
        title: "Betaling modtaget – god tur!",
        preheader: `Din betaling på ${opts.amountTotalDkk} kr er modtaget. Din booking af ${opts.shelterTitle} er bekræftet.`,
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Vi har modtaget din betaling på <strong>${opts.amountTotalDkk} kr</strong>.</p>
          <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
            <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Bekræftet ophold</p>
            <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0 0 2px;">${esc(opts.shelterTitle)}</p>
            <p style="font-size:12px;color:#666;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
          </div>
          ${reference ? `<p style="font-size:12px;color:#666;margin:0 0 8px;"><strong>Bookingreference:</strong> ${esc(reference)}</p>` : ""}
          <p style="font-size:13px;color:#666;margin:0 0 16px;">Din booking er nu bekræftet. <strong>God tur!</strong> Denne e-mail og din bookingside fungerer som bookingbevis ved ankomst.</p>
          <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se din booking på ShelterDK</a>
          <p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser din booking direkte. Vis siden eller denne mail ved ankomst.</p>
        `,
      }),
      text: renderEmailText({
        title: "Betaling modtaget – god tur!",
        lines: [
          `Hej ${opts.guestName}! Vi har modtaget din betaling på ${opts.amountTotalDkk} kr.`,
          `${opts.shelterTitle} · ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
          ...(reference ? [`Bookingreference: ${reference}`] : []),
          "Denne e-mail og din bookingside fungerer som bookingbevis ved ankomst.",
          "Din booking er nu bekræftet. God tur!",
        ],
        url: bookingLink(opts.guestToken),
      }),
      context: {
        emailType: "payment_confirmed_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: { amountTotalDkk: opts.amountTotalDkk },
      },
    }),
    sendLoggedEmail({
      to: ownerRecipients(opts.ownerEmail, opts.notifyEmails),
      subject: `Ny bekræftet booking: ${esc(opts.shelterTitle)}`,
      html: renderEmail({
        title: "Ny bekræftet booking",
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> har betalt <strong>${opts.amountTotalDkk} kr</strong> og booket <strong>${esc(opts.shelterTitle)}</strong>.</p>
          <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
            <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Bekræftet ophold</p>
            <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
          </div>
          <p style="font-size:12px;color:#999;margin:0 0 16px;">Bookingen er automatisk bekræftet. Hvis du skal aflyse, sker der automatisk fuld refundering til gæsten.</p>
          ${opts.ownerToken ? `<a href="${SITE_URL}/owner/${esc(opts.ownerToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se bookingen i ShelterDK</a><p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser den bekræftede booking.</p>` : ""}
        `,
      }),
      text: renderEmailText({
        title: "Ny bekræftet booking",
        lines: [
          `${opts.guestName} har betalt ${opts.amountTotalDkk} kr og booket ${opts.shelterTitle}.`,
          `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
          "Bookingen er automatisk bekræftet. Aflyser du, refunderes gæsten automatisk.",
        ],
        ...(opts.ownerToken ? { url: `${SITE_URL}/owner/${opts.ownerToken}` } : {}),
      }),
      context: {
        emailType: "payment_confirmed_owner",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: { amountTotalDkk: opts.amountTotalDkk },
      },
    }),
    notificationPromise,
  ]);

  if (ownerResult.status === "rejected") {
    console.error("Email-fejl (betaling ejer):", ownerResult.reason);
  }

  if (notificationResult.status === "rejected") {
    console.error("Email-fejl (intern booking-notifikation):", notificationResult.reason);
  }

  if (guestResult.status === "rejected") {
    throw new Error(
      "Email-fejl (betaling gæst): " +
        (guestResult.reason instanceof Error ? guestResult.reason.message : String(guestResult.reason))
    );
  }
}

/** Til ejeren: ny forudbetalt booking afventer din bekræftelse */
export async function sendUpfrontPaymentReceived(opts: {
  ownerEmail: string;
  /** Ekstra modtagere fra bookable_shelters.notify_emails. */
  notifyEmails?: string[] | null;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const subject = `Forudbetalt booking til ${esc(opts.shelterTitle)} — afventer din bekræftelse`;
  const html = renderEmail({
      title: "Ny forudbetalt booking",
      preheader: `${opts.guestName} har forudbetalt ${opts.amountTotalDkk} kr for ${opts.shelterTitle}. Afventer din bekræftelse.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) har forudbetalt <strong>${opts.amountTotalDkk} kr</strong> for <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
          <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
          <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
        </div>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Gæsten afventer din bekræftelse. Afviser du bookingen, refunderes betalingen automatisk.</p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se bookingen i ShelterDK</a>
        <p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser bookingen direkte.</p>
      `,
    });
  const text = renderEmailText({
    title: "Ny forudbetalt booking",
    lines: [
      `${opts.guestName} (${opts.guestEmail}) har forudbetalt ${opts.amountTotalDkk} kr for ${opts.shelterTitle}.`,
      `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
      "Gæsten afventer din bekræftelse. Afviser du bookingen, refunderes betalingen automatisk.",
    ],
    url: dashboardUrl,
  });
  try {
    await sendLoggedEmail({
      to: ownerRecipients(opts.ownerEmail, opts.notifyEmails),
      subject,
      html,
      text,
      context: {
        emailType: "upfront_payment_received_owner",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: { guestEmail: opts.guestEmail, amountTotalDkk: opts.amountTotalDkk },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (forudbetaling ejer): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: booking afvist, betaling refunderes */
export async function sendRefundedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  refundStatus?: "refunded" | "manual_follow_up";
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const refundStatus = opts.refundStatus ?? "refunded";
  const refundHtml =
    refundStatus === "refunded"
      ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5–10 hverdage.</p>`
      : `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> kunne ikke refunderes automatisk. Vi følger manuelt op hurtigst muligt.</p>`;
  const refundText =
    refundStatus === "refunded"
      ? `Din betaling på ${opts.amountTotalDkk} kr refunderes inden for 5–10 hverdage.`
      : `Din betaling på ${opts.amountTotalDkk} kr kunne ikke refunderes automatisk. Vi følger manuelt op hurtigst muligt.`;
  const title =
    refundStatus === "refunded"
      ? "Booking afvist — refundering på vej"
      : "Booking afvist — manuel refundering følger";
  const subject =
    refundStatus === "refunded"
      ? `Din booking af ${esc(opts.shelterTitle)} er afvist — refundering på vej`
      : `Din booking af ${esc(opts.shelterTitle)} er afvist — vi følger manuelt op`;

  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html: renderEmail({
        title,
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
          <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 10px;">Desværre kunne ejeren ikke imødekomme din forudbetaling til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
          ${refundHtml}
          <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
        `,
      }),
      text: renderEmailText({
        title,
        lines: [
          `Hej ${opts.guestName},`,
          `Desværre kunne ejeren ikke imødekomme din forudbetaling til ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
          refundText,
        ],
        url: "https://shelterdk.dk/soeg",
      }),
      context: {
        emailType: "refunded_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: { amountTotalDkk: opts.amountTotalDkk, refundStatus },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (refundering gæst): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæst + ejer: booking annulleret pga. manglende betaling */
export async function sendBookingExpired(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  /** Ekstra modtagere fra bookable_shelters.notify_emails. */
  notifyEmails?: string[] | null;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const [guestResult, ownerResult] = await Promise.allSettled([
    sendLoggedEmail({
      to: opts.guestEmail,
      subject: "Din booking er udløbet",
      html: renderEmail({
        title: "Din booking er udløbet",
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
          <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 16px;">Din booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er desværre annulleret, da betalingsfristen på 24 timer ikke blev overholdt.</p>
          <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
        `,
      }),
      text: renderEmailText({
        title: "Din booking er udløbet",
        lines: [
          `Hej ${opts.guestName},`,
          `Din booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}) er annulleret, da betalingsfristen på 24 timer ikke blev overholdt.`,
        ],
        url: "https://shelterdk.dk/soeg",
      }),
      context: {
        emailType: "booking_expired_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
      },
    }),
    sendLoggedEmail({
      to: ownerRecipients(opts.ownerEmail, opts.notifyEmails),
      subject: `Booking udløbet — dato er ledig igen`,
      html: renderEmail({
        title: "Booking udløbet",
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Bookingen fra <strong>${esc(opts.guestName)}</strong> af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er annulleret, da gæsten ikke betalte inden for 24 timer.</p>
          <p style="font-size:13px;color:#666;margin:0;">Datoen er ledig igen.</p>
        `,
      }),
      text: renderEmailText({
        title: "Booking udløbet",
        lines: [
          `Bookingen fra ${opts.guestName} af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}) er annulleret da gæsten ikke betalte inden for 24 timer.`,
          "Datoen er ledig igen.",
        ],
      }),
      context: {
        emailType: "booking_expired_owner",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
      },
    }),
  ]);

  if (ownerResult.status === "rejected") {
    console.error("Email-fejl (udløbet ejer):", ownerResult.reason);
  }

  if (guestResult.status === "rejected") {
    throw new Error(
      "Email-fejl (udløbet gæst): " +
        (guestResult.reason instanceof Error ? guestResult.reason.message : String(guestResult.reason))
    );
  }
}

// ─── Cancellation emails ──────────────────────────────────────────────────────

/** Til gæsten: de har selv annulleret */
export async function sendGuestCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  refundStatus: "refunded" | "manual_follow_up" | "not_refunded";
  amountTotalDkk: number | null;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const refundHtml = opts.refundStatus === "refunded" && opts.amountTotalDkk
    ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5–10 hverdage.</p>`
    : opts.refundStatus === "manual_follow_up" && opts.amountTotalDkk
      ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> kunne ikke refunderes automatisk. Vi følger manuelt op hurtigst muligt.</p>`
      : opts.amountTotalDkk
      ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Betalingen på <strong>${opts.amountTotalDkk} kr</strong> refunderes ikke, da annulleringen sker inden for aflysningsfristen.</p>`
      : "";
  const refundText = opts.refundStatus === "refunded" && opts.amountTotalDkk
    ? `Din betaling på ${opts.amountTotalDkk} kr refunderes inden for 5–10 hverdage.`
    : opts.refundStatus === "manual_follow_up" && opts.amountTotalDkk
      ? `Din betaling på ${opts.amountTotalDkk} kr kunne ikke refunderes automatisk. Vi følger manuelt op hurtigst muligt.`
      : opts.amountTotalDkk
      ? `Betalingen på ${opts.amountTotalDkk} kr refunderes ikke (inden for aflysningsfrist).`
      : "";

  const subject = `Din booking af ${esc(opts.shelterTitle)} er annulleret`;
  const html = renderEmail({
      title: "Booking annulleret",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
        <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 10px;">Din booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er nu annulleret.</p>
        ${refundHtml}
        <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
      `,
    });
  const text = renderEmailText({
    title: "Booking annulleret",
    lines: [
      `Hej ${opts.guestName},`,
      `Din booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}) er nu annulleret.`,
      ...(refundText ? [refundText] : []),
    ],
    url: "https://shelterdk.dk/soeg",
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "guest_cancelled_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: { refundStatus: opts.refundStatus, amountTotalDkk: opts.amountTotalDkk },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (gæst annulleret til gæst): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til ejeren: en gæst har annulleret */
export async function sendGuestCancelledToOwner(opts: {
  ownerEmail: string;
  /** Ekstra modtagere fra bookable_shelters.notify_emails. */
  notifyEmails?: string[] | null;
  ownerToken: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const subject = `Booking annulleret af gæst: ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
      title: "Booking annulleret af gæst",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> har annulleret sin booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Datoen er nu ledig igen.</p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se annulleringen i ShelterDK</a>
        <p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser den annullerede booking.</p>
      `,
    });
  const text = renderEmailText({
    title: "Booking annulleret af gæst",
    lines: [
      `${opts.guestName} har annulleret sin booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
      "Datoen er nu ledig igen.",
    ],
    url: dashboardUrl,
  });
  try {
    await sendLoggedEmail({
      to: ownerRecipients(opts.ownerEmail, opts.notifyEmails),
      subject,
      html,
      text,
      context: {
        emailType: "guest_cancelled_owner",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (gæst annulleret til ejer): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: ejeren har annulleret deres bekræftede booking */
export async function sendOwnerCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  refundStatus: "refunded" | "manual_follow_up" | "not_refunded";
  amountTotalDkk: number | null;
  bookingId?: string;
  shelterId?: string;
  paymentId?: string;
}) {
  const refundHtml = opts.refundStatus === "refunded" && opts.amountTotalDkk
    ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes fuldt ud inden for 5–10 hverdage.</p>`
    : opts.refundStatus === "manual_follow_up" && opts.amountTotalDkk
      ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> kunne ikke refunderes automatisk. Vi følger manuelt op hurtigst muligt.</p>`
      : "";
  const refundText = opts.refundStatus === "refunded" && opts.amountTotalDkk
    ? `Din betaling på ${opts.amountTotalDkk} kr refunderes fuldt ud inden for 5–10 hverdage.`
    : opts.refundStatus === "manual_follow_up" && opts.amountTotalDkk
      ? `Din betaling på ${opts.amountTotalDkk} kr kunne ikke refunderes automatisk. Vi følger manuelt op hurtigst muligt.`
      : "";

  const subject = `Din booking af ${esc(opts.shelterTitle)} er annulleret af ejeren`;
  const html = renderEmail({
      title: "Booking annulleret af ejeren",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
        <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 10px;">Desværre har ejeren annulleret din booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        ${refundHtml}
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Vi beklager ulejligheden.</p>
        <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
      `,
    });
  const text = renderEmailText({
    title: "Booking annulleret af ejeren",
    lines: [
      `Hej ${opts.guestName},`,
      `Desværre har ejeren annulleret din booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
      ...(refundText ? [refundText] : []),
      "Vi beklager ulejligheden.",
    ],
    url: "https://shelterdk.dk/soeg",
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "owner_cancelled_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
        paymentId: opts.paymentId ?? null,
        metadata: { refundStatus: opts.refundStatus, amountTotalDkk: opts.amountTotalDkk },
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (ejer annulleret til gæst): " + (error instanceof Error ? error.message : String(error)));
  }
}

// ─── Message notification emails ─────────────────────────────────────────────

/** Til ejeren: gæsten har sendt en ny besked */
export async function sendNewMessageToOwner(opts: {
  ownerEmail: string;
  /** Ekstra modtagere fra bookable_shelters.notify_emails. */
  notifyEmails?: string[] | null;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  messageBody: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const subject = `Ny besked fra ${esc(opts.guestName)} – ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
      title: `Ny besked fra ${opts.guestName}`,
      preheader: `${opts.guestName} har sendt en besked om ${opts.shelterTitle}.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;"><strong>${esc(opts.guestName)}</strong> har sendt en besked om <strong>${esc(opts.shelterTitle)}</strong>:</p>
        <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0 0 16px;padding:10px 14px;border-radius:0 6px 6px 0;">
          <p style="font-size:13px;color:#555;line-height:1.5;margin:0;font-style:italic;">${esc(opts.messageBody).replace(/\n/g, "<br>")}</p>
        </blockquote>
        <a href="${dashboardUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Svar i ShelterDK</a>
        <p style="font-size:12px;color:#999;margin:12px 0 0;">Linket åbner shelterdk.dk og viser samtalen direkte.</p>
      `,
    });
  const text = renderEmailText({
    title: `Ny besked fra ${opts.guestName}`,
    lines: [
      `${opts.guestName} har sendt en besked om ${opts.shelterTitle}:`,
      opts.messageBody,
    ],
    url: dashboardUrl,
  });
  try {
    await sendLoggedEmail({
      to: ownerRecipients(opts.ownerEmail, opts.notifyEmails),
      subject,
      html,
      text,
      context: {
        emailType: "new_message_owner",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (besked til ejer): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten: ejeren har sendt en ny besked */
export async function sendNewMessageToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  guestToken: string;
  messageBody: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const subject = `Ny besked om din booking af ${esc(opts.shelterTitle)}`;
  const html = renderEmail({
      title: "Ny besked fra ejeren",
      preheader: `Ejeren af ${opts.shelterTitle} har sendt dig en besked.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">Hej <strong>${esc(opts.guestName)}</strong>! Ejeren af <strong>${esc(opts.shelterTitle)}</strong> har sendt dig en besked:</p>
        <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0 0 16px;padding:10px 14px;border-radius:0 6px 6px 0;">
          <p style="font-size:13px;color:#555;line-height:1.5;margin:0;font-style:italic;">${esc(opts.messageBody).replace(/\n/g, "<br>")}</p>
        </blockquote>
        <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Svar via din booking</a>
      `,
    });
  const text = renderEmailText({
    title: "Ny besked fra ejeren",
    lines: [
      `Hej ${opts.guestName}! Ejeren af ${opts.shelterTitle} har sendt dig en besked:`,
      opts.messageBody,
    ],
    url: bookingLink(opts.guestToken),
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "new_message_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (besked til gæst): " + (error instanceof Error ? error.message : String(error)));
  }
}

/** Til gæsten dagen efter check-out: bed om en anmeldelse af opholdet. */
export async function sendReviewRequestToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  guestToken: string;
  bookingId?: string;
  shelterId?: string;
}) {
  const subject = `Hvordan var dit ophold på ${opts.shelterTitle}?`;
  const reviewUrl = `${SITE_URL}/anmeld/${opts.guestToken}`;
  const html = renderEmail({
    title: "Hvordan var dit ophold?",
    preheader: `Del din oplevelse på ${opts.shelterTitle} — det tager under et minut.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Vi håber, du havde en god tur til <strong>${esc(opts.shelterTitle)}</strong>.</p>
      <p style="font-size:13px;color:#666;margin:0 0 16px;">Vil du hjælpe andre shelter-gæster ved at dele din oplevelse? Det tager under et minut — giv stjerner og skriv evt. et par ord.</p>
      <a href="${reviewUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Anmeld dit ophold</a>
      <p style="font-size:12px;color:#999;margin:12px 0 0;">Din anmeldelse vises på shelterets side på shelterdk.dk med dit fornavn.</p>
    `,
  });
  const text = renderEmailText({
    title: "Hvordan var dit ophold?",
    lines: [
      `Hej ${opts.guestName}! Vi håber, du havde en god tur til ${opts.shelterTitle}.`,
      "Vil du hjælpe andre shelter-gæster ved at dele din oplevelse? Det tager under et minut.",
    ],
    url: reviewUrl,
  });
  try {
    await sendLoggedEmail({
      to: opts.guestEmail,
      subject,
      html,
      text,
      context: {
        emailType: "review_request_guest",
        bookingId: opts.bookingId ?? null,
        shelterId: opts.shelterId ?? null,
      },
    });
  } catch (error) {
    throw new Error("Email-fejl (anmeldelses-anmodning): " + (error instanceof Error ? error.message : String(error)));
  }
}
