/**
 * Hvor en besoegende kom fra, udledt af referreren.
 *
 * Findes fordi AI-assistenter er blevet en maalbar kanal, men en kanal vi kun
 * kan se halvdelen af. Andelen af affiliate-klik fra AI voksede fra 0,9 % i
 * juni til 5,5 % i oktober 2026, og det tal bygger udelukkende paa, at
 * ChatGPT, Copilot og Perplexity selv tilfoejer en utm-parameter til det link,
 * de citerer. Claude og Gemini goer det ofte ikke, saa deres henvisninger
 * taelles som direkte trafik, og 5,5 % er derfor et gulv.
 *
 * Her klassificeres baade utm-kilden og referrerens vaertsnavn, saa de to veje
 * giver samme svar.
 */

/** Kanalen et besoeg kom fra. */
export type Kilde = "ai" | "soegemaskine" | "social" | "internt" | "andet" | "ukendt";

/**
 * Vaerter der leverer et AI-genereret svar med henvisninger.
 *
 * Matches paa vaertsnavnet og dets underdomaener, saa baade chatgpt.com og
 * chat.openai.com rammer. Listen er med vilje kort: en vaert hoerer kun her,
 * hvis dens henvisninger kommer fra et sprogmodel-svar og ikke fra en
 * almindelig resultatliste. Bing er derfor ikke med, selv om Copilot bygger
 * paa den, mens copilot.microsoft.com er.
 */
const AI_VAERTER = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "copilot.com",
  "bard.google.com",
  "you.com",
  "phind.com",
  "mistral.ai",
  "chat.deepseek.com",
  "grok.com",
  "x.ai",
];

const SOEGE_VAERTER = [
  "google.com",
  "google.dk",
  "bing.com",
  "duckduckgo.com",
  "ecosia.org",
  "yahoo.com",
  "startpage.com",
  "search.brave.com",
  "baidu.com",
  "yandex.ru",
];

const SOCIAL_VAERTER = [
  "facebook.com",
  "m.facebook.com",
  "l.facebook.com",
  "instagram.com",
  "t.co",
  "x.com",
  "twitter.com",
  "reddit.com",
  "linkedin.com",
  "pinterest.com",
  "youtube.com",
  "tiktok.com",
];

const EGNE_VAERTER = ["shelterdk.dk", "www.shelterdk.dk", "localhost"];

/**
 * Vaertsnavnet fra en referrer, uden sti og forespoergselsstreng.
 *
 * Kun vaertsnavnet gemmes nogensinde. Det raekker til at skelne kanalerne og
 * kan ikke pege paa en person, saa tabellerne bliver ikke mindre anonyme af
 * at faa kolonnen.
 */
export function referrerVaert(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const v = new URL(referrer).hostname.toLowerCase();
    return v.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Matcher vaerten selv og dens underdomaener, men ikke "ikke-chatgpt.com". */
function passer(vaert: string, liste: string[]): boolean {
  return liste.some((v) => vaert === v || vaert.endsWith(`.${v}`));
}

/**
 * Kanalen, udledt af vaertsnavn og utm-kilde.
 *
 * Utm-kilden vejer tungest, fordi det er assistentens egen maerkning af
 * henvisningen. Falder den ud, bruges vaertsnavnet.
 */
export function kildeFor(
  vaert: string | null | undefined,
  utmSource?: string | null
): Kilde {
  const utm = (utmSource ?? "").toLowerCase().trim();
  if (utm) {
    const somVaert = utm.includes(".") ? utm.replace(/^www\./, "") : null;
    if (somVaert && passer(somVaert, AI_VAERTER)) return "ai";
    if (!somVaert && AI_VAERTER.some((v) => v.split(".")[0] === utm)) return "ai";
    if (somVaert && passer(somVaert, SOEGE_VAERTER)) return "soegemaskine";
  }
  const v = (vaert ?? "").toLowerCase().replace(/^www\./, "");
  if (!v) return "ukendt";
  if (passer(v, EGNE_VAERTER)) return "internt";
  if (passer(v, AI_VAERTER)) return "ai";
  if (passer(v, SOEGE_VAERTER)) return "soegemaskine";
  if (passer(v, SOCIAL_VAERTER)) return "social";
  return "andet";
}

/** Utm-kilden fra en sti med forespoergselsstreng, fx "/bedste/sovepose?utm_source=chatgpt.com". */
export function utmFraSti(sti: string | null | undefined): string | null {
  if (!sti) return null;
  const i = sti.indexOf("?");
  if (i < 0) return null;
  return new URLSearchParams(sti.slice(i + 1)).get("utm_source");
}
