import { sendLoggedEmail, escapeHtml } from "@/lib/email";

/**
 * Outreach-mail til en potentiel shelterdk-kunde. Sendes fra
 * hej@shelterdk.dk (samme afsender som booking-mails) så DKIM/SPF
 * matcher domænet. Reply-to er også hej@shelterdk.dk så svar
 * lander i samme indbakke.
 */

interface SendOutreachOpts {
  toEmail: string;
  subject: string;
  /** Plain text body — kommer fra brugerredigerbar template. */
  body: string;
  shelterId?: string | null;
}

function bodyToHtml(body: string): string {
  // Konverter ren tekst til HTML: split på dobbelt-newline = paragraf,
  // single newline = <br/>. Auto-linkifyer http(s)-URLs.
  const escaped = escapeHtml(body);
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:#8A6A26;text-decoration:underline;word-break:break-all">${url}</a>`
  );
  const paragraphs = withLinks.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs
    .map((p) => `<p style="font-size:15px;line-height:1.65;color:#2C3E50;margin:0 0 16px 0">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export async function sendOutreachEmail(opts: SendOutreachOpts): Promise<void> {
  const html = `
    <div style="font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;color:#2C3E50">
      ${bodyToHtml(opts.body)}
    </div>
  `;
  await sendLoggedEmail({
    to: opts.toEmail,
    subject: opts.subject,
    html,
    text: opts.body,
    replyTo: "hej@shelterdk.dk",
    context: {
      category: "outreach",
      emailType: "outreach_owner_invite",
      shelterId: opts.shelterId ?? null,
    },
  });
}
