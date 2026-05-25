import type { Shelter } from "@/types/shelter";
import { sendLoggedEmail, escapeHtml } from "@/lib/email";
import {
  buildSavedSearchUrl,
  describeSavedSearch,
  type SavedSearchRow,
} from "@/lib/saved-searches";

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
}

/** Standard footer med unsubscribe-link. */
function footerHtml(token: string): string {
  const origin = siteOrigin();
  return `
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px 0" />
    <p style="font-size:12px;color:#666;line-height:1.5;margin:0 0 6px 0">
      Vil du ikke længere have besked om denne søgning?
      <a href="${origin}/api/save-search/${token}/unsubscribe" style="color:#666;text-decoration:underline">Afmeld</a>
    </p>
    <p style="font-size:12px;color:#666;line-height:1.5;margin:0">
      Sendt af ShelterDK — Danmarks shelter-portal.
    </p>
  `;
}

function footerText(token: string): string {
  return `\n\n---\nAfmeld: ${siteOrigin()}/api/save-search/${token}/unsubscribe\nShelterDK — Danmarks shelter-portal.`;
}

/** Bekræftelses-e-mail (double-opt-in). Brugeren har lige tilmeldt sig. */
export async function sendSavedSearchConfirmation(row: SavedSearchRow): Promise<void> {
  const origin = siteOrigin();
  const confirmUrl = `${origin}/api/save-search/${row.token}/confirm`;
  const searchUrl = buildSavedSearchUrl(origin, row);
  const description = describeSavedSearch(row);

  const html = `
    <div style="font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#2C3E50">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 16px 0;color:#2C3E50">
        Bekræft din shelter-alert
      </h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px 0">
        Du har gemt søgningen:
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0;padding:14px 16px;background:#f8f7f3;border-left:3px solid #8A6A26;border-radius:4px">
        <strong>${escapeHtml(description)}</strong>
        <br />
        <a href="${searchUrl}" style="color:#8A6A26;text-decoration:underline;font-size:13px">Vis i søgningen →</a>
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0">
        Klik knappen herunder for at bekræfte din e-mail. Derefter sender vi dig en besked når nye shelters matcher dine kriterier — typisk én gang om dagen, men kun hvis der er nyt.
      </p>
      <p style="margin:0 0 24px 0">
        <a href="${confirmUrl}" style="display:inline-block;padding:12px 28px;background:#8A6A26;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
          Bekræft min e-mail
        </a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#666;margin:0">
        Hvis du ikke har bedt om dette, kan du bare ignorere mailen.
      </p>
      ${footerHtml(row.token)}
    </div>
  `;

  const text = [
    `Bekræft din shelter-alert`,
    ``,
    `Du har gemt søgningen: ${description}`,
    `(Vis i søgningen: ${searchUrl})`,
    ``,
    `Klik linket for at bekræfte din e-mail og aktivere din alert:`,
    confirmUrl,
    ``,
    `Hvis du ikke har bedt om dette, kan du ignorere mailen.`,
    footerText(row.token),
  ].join("\n");

  await sendLoggedEmail({
    to: row.email,
    subject: "Bekræft din shelter-alert",
    html,
    text,
    unsubscribeUrl: `${origin}/api/save-search/${row.token}/unsubscribe`,
    context: {
      category: "newsletter",
      emailType: "saved_search_confirm",
      metadata: { saved_search_id: row.id },
    },
  });
}

/** Alert-mail med nye matches. */
export async function sendSavedSearchAlert(
  row: SavedSearchRow,
  matches: Shelter[]
): Promise<void> {
  if (matches.length === 0) return;
  const origin = siteOrigin();
  const searchUrl = buildSavedSearchUrl(origin, row);
  const description = describeSavedSearch(row);
  const top = matches.slice(0, 6);

  const matchListHtml = top
    .map((s) => {
      const title = escapeHtml(s.title || "Shelter");
      const kommune = escapeHtml(s.kommune || "");
      const url = `${origin}/shelter/${encodeURIComponent(s.slug ?? s.id)}`;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee">
            <a href="${url}" style="color:#2C3E50;text-decoration:none;font-weight:600">${title}</a>
            ${kommune ? `<div style="color:#666;font-size:13px">${kommune} Kommune</div>` : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  const overflowNote =
    matches.length > top.length
      ? `<p style="font-size:14px;color:#666;margin:8px 0 0 0">+ ${matches.length - top.length} flere — <a href="${searchUrl}" style="color:#8A6A26">se alle</a></p>`
      : "";

  const html = `
    <div style="font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#2C3E50">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px 0">
        ${matches.length === 1 ? "1 nyt shelter" : `${matches.length} nye shelters`} matcher din søgning
      </h1>
      <p style="font-size:14px;line-height:1.5;color:#666;margin:0 0 24px 0">
        Søgning: <em>${escapeHtml(description)}</em>
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
        ${matchListHtml}
      </table>
      ${overflowNote}
      <p style="margin:28px 0 0 0">
        <a href="${searchUrl}" style="display:inline-block;padding:10px 22px;background:#8A6A26;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Se alle resultater
        </a>
      </p>
      ${footerHtml(row.token)}
    </div>
  `;

  const text = [
    `${matches.length === 1 ? "1 nyt shelter" : `${matches.length} nye shelters`} matcher din søgning`,
    `Søgning: ${description}`,
    ``,
    ...top.map((s) => `• ${s.title}${s.kommune ? ` — ${s.kommune}` : ""}\n  ${origin}/shelter/${s.slug ?? s.id}`),
    matches.length > top.length ? `\n+ ${matches.length - top.length} flere — ${searchUrl}` : "",
    ``,
    `Se alle resultater: ${searchUrl}`,
    footerText(row.token),
  ]
    .filter(Boolean)
    .join("\n");

  await sendLoggedEmail({
    to: row.email,
    subject: `${matches.length === 1 ? "1 nyt shelter" : `${matches.length} nye shelters`} matcher din søgning`,
    html,
    text,
    unsubscribeUrl: `${origin}/api/save-search/${row.token}/unsubscribe`,
    context: {
      category: "newsletter",
      emailType: "saved_search_alert",
      metadata: { saved_search_id: row.id, match_count: matches.length },
    },
  });
}
