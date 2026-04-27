import { getResend, FROM_EMAIL, escapeHtml } from "./email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

function bookingLink(guestToken: string): string {
  return `${SITE_URL}/min-booking/${guestToken}`;
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
  const bodyHtml =
    applyMessagePlaceholders(escapeHtml(opts.body), opts.ctx).replace(/\n/g, "<br>") +
    '<p style="color:#999;font-size:12px;margin-top:24px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>';

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject,
    html: `<div style="font-family:sans-serif;max-width:600px;">${bodyHtml}</div>`,
  });

  if (error) {
    throw new Error("Email-fejl (auto-besked): " + JSON.stringify(error));
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
}) {
  const confirmUrl = `${SITE_URL}/api/booking/action/${opts.confirmToken}`;
  const rejectUrl = `${SITE_URL}/api/booking/action/${opts.rejectToken}`;
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Ny bookingforespørgsel til ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny bookingforespørgsel</h2>
        <p><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) ønsker at booke <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;color:#666;">Datoer</td><td style="padding:8px;"><strong>${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</strong></td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">Antal personer</td><td style="padding:8px;">${opts.guestCount}</td></tr>
          ${opts.message ? `<tr><td style="padding:8px;color:#666;">Besked</td><td style="padding:8px;">${esc(opts.message)}</td></tr>` : ""}
        </table>
        <div style="margin:24px 0;">
          <a href="${confirmUrl}" style="background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">✓ Acceptér booking</a>
          &nbsp;&nbsp;
          <a href="${rejectUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">✗ Afvis booking</a>
        </div>
        <p style="color:#666;font-size:14px;">Eller administrér via dit <a href="${dashboardUrl}">dashboard</a>. Linkene udløber om 7 dage.</p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (ejer forespørgsel): " + JSON.stringify(error));
}

/** Til gæsten: bekræftelse på at forespørgsel er modtaget */
export async function sendBookingReceivedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Vi har modtaget din forespørgsel til ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}!</h2>
        <p>Vi har modtaget din bookingforespørgsel til <strong>${esc(opts.shelterTitle)}</strong> fra <strong>${esc(formatDate(opts.checkIn))}</strong> til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
        <p>Ejeren vender tilbage hurtigst muligt.</p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst modtaget): " + JSON.stringify(error));
}

/** Til gæsten: booking bekræftet */
export async function sendBookingConfirmedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  guestToken: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking er bekræftet! 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#16a34a;">Din booking er bekræftet! 🎉</h2>
        <p>Hej ${esc(opts.guestName)}!</p>
        <p>Din booking af <strong>${esc(opts.shelterTitle)}</strong> fra <strong>${esc(formatDate(opts.checkIn))}</strong> til <strong>${esc(formatDate(opts.checkOut))}</strong> er bekræftet.</p>
        <p><strong>God tur!</strong></p>
        <p><a href="${bookingLink(opts.guestToken)}" style="color:#c5a059;">Se og administrér din booking</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst bekræftet): " + JSON.stringify(error));
}

/** Til gæsten: booking afvist */
export async function sendBookingRejectedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din bookingforespørgsel til ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}</h2>
        <p>Desværre kunne ejeren ikke imødekomme din forespørgsel til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst afvist): " + JSON.stringify(error));
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
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Betal din booking af ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Din booking er klar til betaling</h2>
        <p>Hej ${esc(opts.guestName)}!</p>
        <p>Ejeren har bekræftet din booking af <strong>${esc(opts.shelterTitle)}</strong>
           fra <strong>${esc(formatDate(opts.checkIn))}</strong>
           til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          ${opts.amountShelterDkk > 0
            ? `<tr><td style="padding:8px;color:#666;">Overnatning</td><td style="padding:8px;text-align:right;">${opts.amountShelterDkk} kr</td></tr>`
            : ""}
          <tr style="background:#f9f9f9;">
            <td style="padding:8px;color:#666;">Administrationsgebyr</td>
            <td style="padding:8px;text-align:right;">${opts.amountPlatformDkk} kr</td>
          </tr>
          <tr style="font-weight:bold;border-top:2px solid #eee;">
            <td style="padding:8px;">I alt</td>
            <td style="padding:8px;text-align:right;">${opts.amountTotalDkk} kr</td>
          </tr>
        </table>
        <p><strong>Bemærk:</strong> Betalingslinket udløber om 24 timer.</p>
        <div style="margin:24px 0;">
          <a href="${opts.paymentUrl}"
             style="background:#c5a059;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Betal nu via MobilePay
          </a>
        </div>
        <p style="margin-top:16px;"><a href="${bookingLink(opts.guestToken)}" style="color:#c5a059;">Se din booking</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst betaling): " + JSON.stringify(error));
}

/** Til gæst + ejer: betaling gennemført */
export async function sendPaymentConfirmed(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  guestToken: string;
}) {
  const resend = getResend();
  const [r1, r2] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.guestEmail,
      subject: "Betaling modtaget – booking bekræftet! 🎉",
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#16a34a;">Betaling modtaget – god tur! 🎉</h2>
          <p>Hej ${esc(opts.guestName)}!</p>
          <p>Vi har modtaget din betaling på <strong>${opts.amountTotalDkk} kr</strong>
             for <strong>${esc(opts.shelterTitle)}</strong>
             fra <strong>${esc(formatDate(opts.checkIn))}</strong>
             til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
          <p>Din booking er nu bekræftet. <strong>God tur!</strong></p>
          <p><a href="${bookingLink(opts.guestToken)}" style="color:#c5a059;">Se og administrér din booking</a></p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.ownerEmail,
      subject: `Betaling modtaget: ${esc(opts.shelterTitle)}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#16a34a;">Betaling modtaget</h2>
          <p>${esc(opts.guestName)} har betalt <strong>${opts.amountTotalDkk} kr</strong>
             for <strong>${esc(opts.shelterTitle)}</strong>
             (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
  ]);
  if (r1.error) throw new Error("Email-fejl (betaling gæst): " + JSON.stringify(r1.error));
  if (r2.error) throw new Error("Email-fejl (betaling ejer): " + JSON.stringify(r2.error));
}

/** Til ejeren: ny forudbetalt booking afventer din bekræftelse */
export async function sendUpfrontPaymentReceived(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Forudbetalt booking til ${esc(opts.shelterTitle)} — afventer din bekræftelse`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny forudbetalt booking</h2>
        <p><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) har forudbetalt <strong>${opts.amountTotalDkk} kr</strong> for <strong>${esc(opts.shelterTitle)}</strong> fra <strong>${esc(formatDate(opts.checkIn))}</strong> til <strong>${esc(formatDate(opts.checkOut))}</strong>.</p>
        <p>Gæsten afventer din bekræftelse. Afviser du bookingen, refunderes betalingen automatisk.</p>
        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Gå til dit dashboard</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (forudbetaling ejer): " + JSON.stringify(error));
}

/** Til gæsten: booking afvist, betaling refunderes */
export async function sendRefundedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er afvist — refundering på vej`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}</h2>
        <p>Desværre kunne ejeren ikke imødekomme din forudbetaling til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p>Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5-10 hverdage.</p>
        <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (refundering gæst): " + JSON.stringify(error));
}

/** Til gæst + ejer: booking annulleret pga. manglende betaling */
export async function sendBookingExpired(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const resend = getResend();
  const [r1, r2] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.guestEmail,
      subject: "Din booking er udløbet",
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#dc2626;">Din booking er udløbet</h2>
          <p>Hej ${esc(opts.guestName)},</p>
          <p>Din booking af <strong>${esc(opts.shelterTitle)}</strong>
             (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))})
             er desværre annulleret, da betalingsfristen på 24 timer ikke blev overholdt.</p>
          <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a>.</p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.ownerEmail,
      subject: `Booking udløbet — dato er ledig igen`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#dc2626;">Booking udløbet</h2>
          <p>Bookingen fra ${esc(opts.guestName)} af <strong>${esc(opts.shelterTitle)}</strong>
             (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))})
             er annulleret, da gæsten ikke betalte inden for 24 timer.
             Datoen er ledig igen.</p>
          <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
        </div>
      `,
    }),
  ]);
  if (r1.error) throw new Error("Email-fejl (udløbet gæst): " + JSON.stringify(r1.error));
  if (r2.error) throw new Error("Email-fejl (udløbet ejer): " + JSON.stringify(r2.error));
}

// ─── Cancellation emails ──────────────────────────────────────────────────────

/** Til gæsten: de har selv annulleret */
export async function sendGuestCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  refundEligible: boolean;
  amountTotalDkk: number | null;
}) {
  const refundLine = opts.refundEligible && opts.amountTotalDkk
    ? `<p>Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5–10 hverdage.</p>`
    : opts.amountTotalDkk
      ? `<p>Betalingen på <strong>${opts.amountTotalDkk} kr</strong> refunderes ikke, da annulleringen sker inden for aflysningsfristen.</p>`
      : "";

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er annulleret`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Booking annulleret</h2>
        <p>Hej ${esc(opts.guestName)},</p>
        <p>Din booking af <strong>${esc(opts.shelterTitle)}</strong>
           (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))})
           er nu annulleret.</p>
        ${refundLine}
        <p>Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst annulleret til gæst): " + JSON.stringify(error));
}

/** Til ejeren: en gæst har annulleret */
export async function sendGuestCancelledToOwner(opts: {
  ownerEmail: string;
  ownerToken: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Booking annulleret af gæst: ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Booking annulleret af gæst</h2>
        <p><strong>${esc(opts.guestName)}</strong> har annulleret sin booking af
           <strong>${esc(opts.shelterTitle)}</strong>
           (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p>Datoen er nu ledig igen.</p>
        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Gå til dit dashboard</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (gæst annulleret til ejer): " + JSON.stringify(error));
}

/** Til gæsten: ejeren har annulleret deres bekræftede booking */
export async function sendOwnerCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number | null;
}) {
  const refundLine = opts.amountTotalDkk
    ? `<p>Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes fuldt ud inden for 5–10 hverdage.</p>`
    : "";

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er annulleret af ejeren`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#dc2626;">Booking annulleret</h2>
        <p>Hej ${esc(opts.guestName)},</p>
        <p>Desværre har ejeren annulleret din booking af
           <strong>${esc(opts.shelterTitle)}</strong>
           (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        ${refundLine}
        <p>Vi beklager ulejligheden. Find andre shelters på <a href="https://shelterdk.dk">shelterdk.dk</a></p>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (ejer annulleret til gæst): " + JSON.stringify(error));
}

// ─── Message notification emails ─────────────────────────────────────────────

/** Til ejeren: gæsten har sendt en ny besked */
export async function sendNewMessageToOwner(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  messageBody: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Ny besked fra ${esc(opts.guestName)} – ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Ny besked fra ${esc(opts.guestName)}</h2>
        <p>Du har modtaget en besked vedrørende <strong>${esc(opts.shelterTitle)}</strong>:</p>
        <blockquote style="border-left:3px solid #c5a059;margin:16px 0;padding:8px 16px;color:#444;">
          ${esc(opts.messageBody).replace(/\n/g, "<br>")}
        </blockquote>
        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Svar via dit dashboard</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (besked til ejer): " + JSON.stringify(error));
}

/** Til gæsten: ejeren har sendt en ny besked */
export async function sendNewMessageToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  guestToken: string;
  messageBody: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Ny besked om din booking af ${esc(opts.shelterTitle)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#2C3E50;">Hej ${esc(opts.guestName)}!</h2>
        <p>Ejeren af <strong>${esc(opts.shelterTitle)}</strong> har sendt dig en besked:</p>
        <blockquote style="border-left:3px solid #c5a059;margin:16px 0;padding:8px 16px;color:#444;">
          ${esc(opts.messageBody).replace(/\n/g, "<br>")}
        </blockquote>
        <div style="margin:24px 0;">
          <a href="${bookingLink(opts.guestToken)}" style="background:#c5a059;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Svar via din booking</a>
        </div>
        <p style="color:#999;font-size:12px;">Sendt via <a href="https://shelterdk.dk">ShelterDK</a></p>
      </div>
    `,
  });
  if (error) throw new Error("Email-fejl (besked til gæst): " + JSON.stringify(error));
}
