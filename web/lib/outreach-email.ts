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

const LINK_STYLE = "color:#8A6A26;text-decoration:underline;word-break:break-all";
const P_STYLE = "font-size:15px;line-height:1.65;color:#2C3E50;margin:0 0 16px 0";
const LIST_STYLE = "font-size:15px;line-height:1.65;color:#2C3E50;margin:0 0 16px 0;padding-left:22px";
const LI_STYLE = "margin:0 0 7px 0";

/** Inline-formatering på allerede HTML-escaped tekst: **fed** + auto-links. */
function inlineFormat(text: string): string {
  // **fed** → <strong> (gør det før links, så bold ikke spiser URL'er)
  let out = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="${LINK_STYLE}">${url}</a>`
  );
  return out;
}

/**
 * Konverter brugerredigerbar plain-text/markdown-lite til pæn HTML:
 * - blank linje = nyt afsnit
 * - linjer der starter med "- " (eller "•") = punktliste
 * - linjer der starter med "1. ", "2. " = nummereret liste
 * - **fed** = bold, http(s)-URLs auto-linkes
 */
export function bodyToHtml(body: string): string {
  const escaped = escapeHtml(body);
  const blocks = escaped.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const allBullets = lines.length > 0 && lines.every((l) => /^[-•]\s+/.test(l));
      const allNumbered = lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l));

      if (allBullets) {
        const items = lines
          .map((l) => `<li style="${LI_STYLE}">${inlineFormat(l.replace(/^[-•]\s+/, ""))}</li>`)
          .join("");
        return `<ul style="${LIST_STYLE}">${items}</ul>`;
      }
      if (allNumbered) {
        const items = lines
          .map((l) => `<li style="${LI_STYLE}">${inlineFormat(l.replace(/^\d+\.\s+/, ""))}</li>`)
          .join("");
        return `<ol style="${LIST_STYLE}">${items}</ol>`;
      }
      return `<p style="${P_STYLE}">${inlineFormat(lines.join("<br/>"))}</p>`;
    })
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
