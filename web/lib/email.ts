// lib/email.ts
import { Resend } from "resend";
import { recordEmailLog, type EmailLogCategory } from "./email-log";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const FROM_EMAIL = "ShelterDK <hej@shelterdk.dk>";

/**
 * Filters out addresses that are on the email_suppression list
 * (hard-bounced or complained previously via Resend webhook).
 * Returns the surviving recipients. Failures fall back to "keep all"
 * so a DB outage never blocks transactional emails.
 */
async function filterSuppressed(recipients: string[]): Promise<{
  allowed: string[];
  suppressed: string[];
}> {
  const normalized = recipients.map((r) => r.toLowerCase().trim()).filter(Boolean);
  if (normalized.length === 0) return { allowed: [], suppressed: [] };
  try {
    const { data } = await createAdminClient()
      .from("email_suppression")
      .select("email")
      .in("email", normalized);
    const blocked = new Set((data ?? []).map((r: { email: string }) => r.email));
    return {
      allowed: recipients.filter((r) => !blocked.has(r.toLowerCase().trim())),
      suppressed: recipients.filter((r) => blocked.has(r.toLowerCase().trim())),
    };
  } catch {
    return { allowed: recipients, suppressed: [] };
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export interface SendLoggedEmailContext {
  category?: EmailLogCategory;
  emailType: string;
  bookingId?: string | null;
  paymentId?: string | null;
  shelterId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function sendLoggedEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Optional List-Unsubscribe URL — included for newsletter / promotional sends. */
  unsubscribeUrl?: string;
  context: SendLoggedEmailContext;
}) {
  const rawRecipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const { allowed, suppressed } = await filterSuppressed(rawRecipients);
  if (suppressed.length > 0) {
    // Log the suppression so we have an audit trail; no send attempted.
    void Promise.allSettled(
      suppressed.map((toEmail) =>
        recordEmailLog({
          category: opts.context.category ?? "booking",
          emailType: opts.context.emailType,
          provider: "resend",
          subject: opts.subject,
          previewText: opts.text.slice(0, 500),
          bookingId: opts.context.bookingId,
          paymentId: opts.context.paymentId,
          shelterId: opts.context.shelterId,
          metadata: { ...(opts.context.metadata ?? {}), suppressed: true },
          status: "suppressed",
          toEmail,
        })
      )
    );
  }
  if (allowed.length === 0) {
    // All recipients suppressed; nothing left to send.
    return { data: null, error: null } as const;
  }
  const recipients = allowed;
  const previewText = opts.text.slice(0, 500);
  const sharedContext = {
    category: opts.context.category ?? "booking",
    emailType: opts.context.emailType,
    provider: "resend",
    subject: opts.subject,
    previewText,
    bookingId: opts.context.bookingId,
    paymentId: opts.context.paymentId,
    shelterId: opts.context.shelterId,
    metadata: opts.context.metadata,
  } as const;

  // Gmail/Yahoo bulk-sender requirements (Feb 2024): List-Unsubscribe +
  // one-click POST. Only add for senders that need it (newsletter); leave
  // transactional emails without it so they aren't treated as bulk.
  const headers: Record<string, string> = {};
  if (opts.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  let failureLogged = false;
  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: recipients,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (result.error) {
      failureLogged = true;
      void Promise.allSettled(
        recipients.map((toEmail) =>
          recordEmailLog({
            ...sharedContext,
            status: "failed",
            toEmail,
            errorMessage: JSON.stringify(result.error),
          })
        )
      );
      throw new Error(JSON.stringify(result.error));
    }

    void Promise.allSettled(
      recipients.map((toEmail) =>
        recordEmailLog({
          ...sharedContext,
          status: "sent",
          providerMessageId: (result.data as { id?: string } | null)?.id ?? null,
          toEmail,
        })
      )
    );

    return result;
  } catch (err) {
    if (!failureLogged) {
      void Promise.allSettled(
        recipients.map((toEmail) =>
          recordEmailLog({
            ...sharedContext,
            status: "failed",
            toEmail,
            errorMessage: err instanceof Error ? err.message : String(err),
          })
        )
      );
    }
    throw err;
  }
}

// ─── Email template helpers ───────────────────────────────────────────────────

export interface RenderEmailOpts {
  title: string;      // Vises i header (escapes automatisk)
  bodyHtml: string;   // Indhold — caller er ansvarlig for at escape dynamiske værdier
  preheader?: string; // Skjult preview-tekst (escapes automatisk)
}

export interface RenderEmailTextOpts {
  title: string;
  lines: string[];
  url?: string;
}

// ─── Booking activation emails ────────────────────────────────────────────────

export function buildBookingActivationAdminHtml(opts: {
  name: string;
  organisation: string;
  email: string;
  shelterName: string;
  message?: string | null;
}): string {
  const { name, organisation, email, shelterName, message } = opts;
  return renderEmail({
    title: "Ny forespørgsel: bookingsystem",
    preheader: `${escapeHtml(name)} ønsker bookingsystem for ${escapeHtml(shelterName)}`,
    bodyHtml: `
      <p>En shelter-ejer har anmodet om at få bookingsystemet aktiveret.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px">Navn</td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Organisation</td><td>${escapeHtml(organisation)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Shelter</td><td>${escapeHtml(shelterName)}</td></tr>
        ${message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Besked</td><td>${escapeHtml(message)}</td></tr>` : ""}
      </table>
      <p style="margin-top:16px">Aktiver bookingsystemet på shelterets admin-side og svar ejeren direkte på ovenstående email.</p>
    `,
  });
}

export function buildBookingActivationConfirmHtml(opts: {
  name: string;
  shelterName: string;
}): string {
  const { name, shelterName } = opts;
  return renderEmail({
    title: "Vi har modtaget din forespørgsel",
    preheader: `Tak for din interesse i bookingsystemet til ${escapeHtml(shelterName)}`,
    bodyHtml: `
      <p>Hej ${escapeHtml(name)},</p>
      <p>Tak for din interesse i at tilmelde <strong>${escapeHtml(shelterName)}</strong> til ShelterDKs bookingsystem.</p>
      <p>Vi gennemgår din forespørgsel og vender tilbage til dig inden for <strong>2 hverdage</strong>.</p>
      <p>Har du spørgsmål i mellemtiden, er du velkommen til at skrive til <a href="mailto:hej@shelterdk.dk">hej@shelterdk.dk</a>.</p>
      <p>Med venlig hilsen,<br>Christian, ShelterDK · shelterdk.dk</p>
    `,
  });
}

export async function sendBookingActivationEmails(opts: {
  name: string;
  organisation: string;
  email: string;
  shelterName: string;
  message?: string | null;
}): Promise<void> {
  const { name, organisation, email, shelterName, message } = opts;

  // Admin notification
  await sendLoggedEmail({
    to: "hej@shelterdk.dk",
    replyTo: email,
    subject: `Bookingsystem-forespørgsel: ${shelterName}`,
    html: buildBookingActivationAdminHtml({ name, organisation, email, shelterName, message }),
    text: `Ny bookingsystem-forespørgsel fra ${name} (${organisation}) for ${shelterName}. Email: ${email}.${message ? ` Besked: ${message}` : ""}`,
    context: { category: "contact", emailType: "booking_activation_request" },
  });

  // Owner confirmation
  await sendLoggedEmail({
    to: email,
    subject: "Vi har modtaget din forespørgsel om bookingsystem",
    html: buildBookingActivationConfirmHtml({ name, shelterName }),
    text: `Hej ${name}, tak for din interesse i at tilmelde ${shelterName} til ShelterDKs bookingsystem. Vi vender tilbage inden for 2 hverdage. Spørgsmål? Skriv til hej@shelterdk.dk.`,
    context: { category: "contact", emailType: "booking_activation_confirm" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function renderEmail(opts: RenderEmailOpts): string {
  const { bodyHtml, preheader } = opts;
  const safeTitle = escapeHtml(opts.title);
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : "";
  const trustNotice = `
    <div style="background:#f7f5f1;border:1px solid #ede9e1;border-radius:8px;padding:10px 12px;margin:0 0 16px;">
      <p style="font-size:12px;color:#475569;line-height:1.55;margin:0 0 6px;">
        Du modtager denne mail fra <strong>ShelterDK</strong>, fordi du har en booking, har sendt en forespørgsel eller er registreret som kontakt for et shelter på <strong>shelterdk.dk</strong>.
      </p>
      <p style="font-size:11px;color:#64748b;line-height:1.55;margin:0;">
        Links i mailen åbner <strong>shelterdk.dk</strong> eller vores betalingsside, hvis mailen handler om betaling. Spørgsmål: <a href="mailto:hej@shelterdk.dk" style="color:#c5a059;text-decoration:none;">hej@shelterdk.dk</a>
      </p>
    </div>`;
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,Arial,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">
      <tr>
        <td style="background:#2C3E50;padding:18px 24px;">
          <p style="color:#c5a059;font-size:10px;font-weight:700;letter-spacing:2px;margin:0 0 3px;text-transform:uppercase;">SHELTERDK</p>
          <p style="color:white;font-size:15px;font-weight:600;margin:0;line-height:1.3;">${safeTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px 16px;">
          ${trustNotice}
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#faf9f7;border-top:1px solid #ede9e1;padding:11px 24px;">
          <p style="font-size:10px;color:#9aa4b2;line-height:1.5;margin:0;">
            Sendt fra <strong>hej@shelterdk.dk</strong> via <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a> · Find shelters i hele Danmark
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(opts: RenderEmailTextOpts): string {
  const { title, lines, url } = opts;
  const sep = "-".repeat(30);
  const parts: string[] = [`SHELTERDK — ${title}`, sep, ""];
  for (const line of lines) {
    parts.push(line, "");
  }
  if (url) {
    parts.push(url, "");
  }
  parts.push(
    "Du modtager denne mail fra ShelterDK, fordi du har en booking, en forespørgsel eller er registreret som kontakt for et shelter på shelterdk.dk.",
    "Links i mailen peger på shelterdk.dk eller på vores betalingsside, hvis mailen handler om betaling.",
    "Spørgsmål: hej@shelterdk.dk",
    "",
    sep,
    "shelterdk.dk"
  );
  return parts.join("\n");
}

// ─── Email functions ──────────────────────────────────────────────────────────

export async function sendContactEmail(opts: {
  toEmail: string;
  toName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  postTitle: string;
}) {
  const { toEmail, toName, senderName, senderEmail, message, postTitle } = opts;
  await sendLoggedEmail({
    to: toEmail,
    replyTo: senderEmail,
    subject: `Ny besked om dit opslag: ${postTitle}`,
    html: renderEmail({
      title: "Ny besked via Turvenner",
      preheader: `${senderName} har sendt dig en besked om "${postTitle}".`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">Hej <strong>${escapeHtml(toName)}</strong>! Du har fået en besked om dit opslag <strong>"${escapeHtml(postTitle)}"</strong> på ShelterDK.</p>
        <p style="font-size:13px;color:#666;margin:0 0 4px;"><strong>Fra:</strong> ${escapeHtml(senderName)} (${escapeHtml(senderEmail)})</p>
        <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:12px 0;padding:10px 14px;border-radius:0 6px 6px 0;">
          <p style="font-size:13px;color:#555;line-height:1.5;margin:0;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        </blockquote>
        <p style="font-size:12px;color:#999;margin:12px 0 0;">Du kan svare direkte på denne email for at kontakte ${escapeHtml(senderName)}.</p>
      `,
    }),
    text: renderEmailText({
      title: "Ny besked via Turvenner",
      lines: [
        `Hej ${toName}! Du har fået en besked om dit opslag "${postTitle}".`,
        `Fra: ${senderName} (${senderEmail})`,
        message,
        "Du kan svare direkte på denne email.",
      ],
    }),
    context: {
      category: "contact",
      emailType: "turvenner_contact",
      metadata: {
        senderName,
        senderEmail,
        postTitle,
      },
    },
  });
}

export async function sendOwnerPortalInviteEmail(opts: {
  toEmail: string;
  shelterTitle: string;
  signupUrl: string;
  loginUrl: string;
  shelterId?: string;
}) {
  const { toEmail, shelterTitle, signupUrl, loginUrl } = opts;
  const subject = `Opret din ejerkonto for ${shelterTitle}`;
  const html = renderEmail({
    title: "Inviteret til ShelterDK ejerportal",
    preheader: `Du er inviteret til at administrere ${shelterTitle} i ShelterDK.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Hej! Du er inviteret til at administrere <strong>${escapeHtml(shelterTitle)}</strong> i ShelterDKs ejerportal.
      </p>
      <p style="font-size:13px;color:#555;line-height:1.65;margin:0 0 16px;">
        Opret din konto via knappen nedenfor med den email, som dette shelter er registreret på. Har du allerede en konto, kan du logge ind bagefter med samme email.
      </p>
      <div style="margin:18px 0;">
        <a href="${signupUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;">
          Opret ejerkonto
        </a>
      </div>
      <p style="font-size:12px;color:#777;line-height:1.55;margin:0 0 8px;">
        Har du allerede oprettet en konto? Brug dette login-link i stedet:
      </p>
      <p style="font-size:12px;line-height:1.55;margin:0;">
        <a href="${loginUrl}" style="color:#c5a059;text-decoration:none;">${escapeHtml(loginUrl)}</a>
      </p>
    `,
  });
  const text = renderEmailText({
    title: "Inviteret til ShelterDK ejerportal",
    lines: [
      `Du er inviteret til at administrere ${shelterTitle} i ShelterDKs ejerportal.`,
      "Opret din konto med den email, som shelteret er registreret på.",
      `Signup: ${signupUrl}`,
      `Login: ${loginUrl}`,
    ],
  });

  try {
    await sendLoggedEmail({
      to: toEmail,
      subject,
      html,
      text,
      context: {
        category: "owner_portal",
        emailType: "owner_portal_invite",
        shelterId: opts.shelterId ?? null,
        metadata: { shelterTitle },
      },
    });
  } catch (error) {
    console.error("Resend error:", error);
    throw new Error("Kunne ikke sende invite-email.");
  }
}

// ─── Admin reply email ─────────────────────────────────────────────────────────

export interface AdminReplyEmailOpts {
  toName: string;
  replyText: string;
  originalMessage: string;
}

export function buildAdminReplyEmailHtml(opts: AdminReplyEmailOpts): string {
  const { toName, replyText, originalMessage } = opts;
  return renderEmail({
    title: "Svar fra ShelterDK",
    preheader: replyText.slice(0, 120),
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Hej <strong>${escapeHtml(toName)}</strong>,
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        ${escapeHtml(replyText).replace(/\n/g, "<br>")}
      </p>
      <p style="font-size:12px;color:#777;margin:0 0 4px;">Med venlig hilsen,</p>
      <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 16px;">
        Christian<br>
        <span style="font-weight:400;color:#777;">ShelterDK &middot; <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a></span>
      </p>
      <hr style="border:none;border-top:1px solid #ede9e1;margin:16px 0;">
      <p style="font-size:11px;color:#aaa;margin:0 0 6px;">Din oprindelige besked:</p>
      <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0;padding:10px 14px;border-radius:0 6px 6px 0;">
        <p style="font-size:12px;color:#666;line-height:1.5;margin:0;">
          ${escapeHtml(originalMessage).replace(/\n/g, "<br>")}
        </p>
      </blockquote>
    `,
  });
}

export function buildAdminReplyEmailText(opts: { replyText: string; originalMessage: string }): string {
  return renderEmailText({
    title: "Svar fra ShelterDK",
    lines: [
      opts.replyText,
      "",
      "Med venlig hilsen,",
      "Christian",
      "ShelterDK · shelterdk.dk",
      "",
      "---",
      "Din oprindelige besked:",
      opts.originalMessage,
    ],
  });
}

export async function sendAdminReplyEmail(opts: {
  toEmail: string;
  toName: string;
  replyText: string;
  originalMessage: string;
  contactMessageId: string;
}) {
  const html = buildAdminReplyEmailHtml(opts);
  const text = buildAdminReplyEmailText(opts);
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: "Re: Din henvendelse til ShelterDK",
    html,
    text,
    context: {
      category: "contact",
      emailType: "admin_reply",
      metadata: {
        contactMessageId: opts.contactMessageId,
        toName: opts.toName,
      },
    },
  });
}

// ─── Shelter submission emails ─────────────────────────────────────────────

export function buildShelterApprovedEmailHtml(opts: {
  shelterName: string;
  shelterSlug: string;
}): string {
  const { shelterName, shelterSlug } = opts;
  const shelterUrl = `https://shelterdk.dk/shelter/${shelterSlug}`;
  return renderEmail({
    title: "Dit shelter er nu på ShelterDK 🏕️",
    preheader: `${escapeHtml(shelterName)} er godkendt og live på ShelterDK!`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Tillykke! Dit shelter <strong>${escapeHtml(shelterName)}</strong> er nu godkendt og live på ShelterDK.
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        Du kan se dit shelter her:<br>
        <a href="${shelterUrl}" style="color:#c5a059;text-decoration:none;">${shelterUrl}</a>
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        Du er velkommen til at svare på denne mail med spørgsmål.
      </p>
      <p style="font-size:12px;color:#777;margin:0 0 4px;">Med venlig hilsen,</p>
      <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 16px;">
        Christian<br>
        <span style="font-weight:400;color:#777;">ShelterDK &middot; <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a></span>
      </p>
    `,
  });
}

export function buildShelterRejectedEmailHtml(opts: {
  shelterName: string;
  reason: string;
}): string {
  const { shelterName, reason } = opts;
  return renderEmail({
    title: "Din shelter-ansøgning til ShelterDK",
    preheader: `Tak for din ansøgning om ${escapeHtml(shelterName)}.`,
    bodyHtml: `
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Tak for at du indsendte <strong>${escapeHtml(shelterName)}</strong> til ShelterDK.
      </p>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">
        Desværre kan vi ikke godkende ansøgningen på nuværende tidspunkt:
      </p>
      <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0 0 16px;padding:10px 14px;border-radius:0 6px 6px 0;">
        <p style="font-size:13px;color:#555;line-height:1.5;margin:0;">
          ${escapeHtml(reason).replace(/\n/g, "<br>")}
        </p>
      </blockquote>
      <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 16px;">
        Du er velkommen til at indsende en ny ansøgning når ovenstående er på plads.
      </p>
      <p style="font-size:12px;color:#777;margin:0 0 4px;">Med venlig hilsen,</p>
      <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 16px;">
        Christian<br>
        <span style="font-weight:400;color:#777;">ShelterDK &middot; <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a></span>
      </p>
    `,
  });
}

export async function sendShelterApprovedEmail(opts: {
  toEmail: string;
  shelterName: string;
  shelterSlug: string;
  submissionId: string;
}) {
  const html = buildShelterApprovedEmailHtml(opts);
  const text = `Tillykke! Dit shelter "${opts.shelterName}" er nu godkendt og live på ShelterDK.\n\nhttps://shelterdk.dk/shelter/${opts.shelterSlug}\n\nDu er velkommen til at svare på denne mail med spørgsmål.\n\nMed venlig hilsen,\nChristian\nShelterDK · shelterdk.dk`;
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: "Dit shelter er nu på ShelterDK 🏕️",
    html,
    text,
    context: {
      category: "contact",
      emailType: "shelter_approved",
      metadata: { submissionId: opts.submissionId, shelterName: opts.shelterName },
    },
  });
}

export async function sendShelterRejectedEmail(opts: {
  toEmail: string;
  shelterName: string;
  reason: string;
  submissionId: string;
}) {
  const html = buildShelterRejectedEmailHtml(opts);
  const text = `Tak for din ansøgning om "${opts.shelterName}".\n\nDesværre kan vi ikke godkende ansøgningen:\n\n${opts.reason}\n\nDu er velkommen til at indsende igen.\n\nMed venlig hilsen,\nChristian\nShelterDK · shelterdk.dk`;
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: "Din shelter-ansøgning til ShelterDK",
    html,
    text,
    context: {
      category: "contact",
      emailType: "shelter_rejected",
      metadata: { submissionId: opts.submissionId, shelterName: opts.shelterName },
    },
  });
}
