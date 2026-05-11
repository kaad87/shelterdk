// lib/email.ts
import { Resend } from "resend";
import { recordEmailLog, type EmailLogCategory } from "./email-log";

export const FROM_EMAIL = "ShelterDK <hej@shelterdk.dk>";

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
  context: SendLoggedEmailContext;
}) {
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
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
  let failureLogged = false;
  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: recipients,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
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

export function renderEmail(opts: RenderEmailOpts): string {
  const { bodyHtml, preheader } = opts;
  const safeTitle = escapeHtml(opts.title);
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : "";
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
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#faf9f7;border-top:1px solid #ede9e1;padding:11px 24px;">
          <p style="font-size:10px;color:#bbb;margin:0;">Sendt via <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a> · Find shelters i hele Danmark</p>
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
  parts.push(sep, "shelterdk.dk");
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
