import type { Shelter } from "@/types/shelter";
import { escapeHtml } from "@/lib/email";
import { getResolvedDisplayImageUrl } from "@shared/lib/shelter-detail";
import { newShelterHref } from "@/lib/new-shelters";

export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
}

/** Absolut billed-URL til e-mail (proxy-stier prefixes med origin). */
function emailImageUrl(shelter: Shelter, origin: string): string | null {
  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const ref = Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null;
  const url = getResolvedDisplayImageUrl(shelter, ref);
  if (!url) return null;
  return url.startsWith("/") ? `${origin}${url}` : url;
}

function shelterLocation(shelter: Shelter): string | null {
  const k = (shelter.kommune ?? "").trim();
  if (k) return k;
  const r = (shelter.region ?? "").trim();
  return r && r.toLowerCase() !== "danmark" ? r : null;
}

interface BuildDigestOpts {
  /** Per-modtager afmeldings-URL (sættes i footer + List-Unsubscribe). */
  unsubscribeUrl: string;
  origin?: string;
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Byg "ugens nye shelters"-digest. Generelt nyhedsbrev til alle abonnenter.
 * Returnerer null hvis der ingen shelters er (cron springer over afsendelse).
 */
export function buildNewSheltersDigest(shelters: Shelter[], opts: BuildDigestOpts): DigestEmail | null {
  if (shelters.length === 0) return null;
  const origin = opts.origin ?? siteOrigin();
  const count = shelters.length;
  const subject = count === 1 ? "Et nyt shelter på ShelterDK 🏕️" : `${count} nye shelters i denne uge 🏕️`;

  const cardsHtml = shelters
    .map((s) => {
      const href = `${origin}${newShelterHref(s)}`;
      const img = emailImageUrl(s, origin);
      const loc = shelterLocation(s);
      const imgBlock = img
        ? `<a href="${href}" style="text-decoration:none"><img src="${escapeHtml(img)}" alt="${escapeHtml(s.title)}" width="100%" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;object-fit:cover" /></a>`
        : "";
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0">
        <tr><td>
          ${imgBlock}
          <h3 style="font-family:Georgia,serif;font-size:18px;margin:12px 0 4px 0;color:#2C3E50">
            <a href="${href}" style="color:#2C3E50;text-decoration:none">${escapeHtml(s.title)}</a>
          </h3>
          ${loc ? `<p style="font-size:14px;color:#666;margin:0 0 8px 0">${escapeHtml(loc)}</p>` : ""}
          <a href="${href}" style="font-size:14px;color:#8A6A26;text-decoration:underline">Se shelteret →</a>
        </td></tr>
      </table>`;
    })
    .join("\n");

  const html = `
    <div style="font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#2C3E50">
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 8px 0;color:#2C3E50">
        Nye shelters i denne uge
      </h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0;color:#444">
        Her er de seneste shelters og shelterpladser tilføjet til ShelterDK. God tur!
      </p>
      ${cardsHtml}
      <p style="margin:28px 0 8px 0;text-align:center">
        <a href="${origin}/nye" style="display:inline-block;padding:12px 28px;background:#8A6A26;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
          Se alle nye shelters
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px 0" />
      <p style="font-size:12px;color:#666;line-height:1.5;margin:0 0 6px 0">
        Du modtager denne mail, fordi du er tilmeldt ShelterDK's nyhedsbrev.
        <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#666;text-decoration:underline">Afmeld</a>
      </p>
      <p style="font-size:12px;color:#666;line-height:1.5;margin:0">
        ShelterDK — Danmarks shelter-portal.
      </p>
    </div>`;

  const textLines = shelters.map((s) => {
    const href = `${origin}${newShelterHref(s)}`;
    const loc = shelterLocation(s);
    return `• ${s.title}${loc ? ` (${loc})` : ""}\n  ${href}`;
  });
  const text = [
    "Nye shelters i denne uge",
    "",
    "Her er de seneste shelters tilføjet til ShelterDK:",
    "",
    ...textLines,
    "",
    `Se alle nye shelters: ${origin}/nye`,
    "",
    "---",
    `Afmeld nyhedsbrev: ${opts.unsubscribeUrl}`,
    "ShelterDK — Danmarks shelter-portal.",
  ].join("\n");

  return { subject, html, text };
}
