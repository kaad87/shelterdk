import type { MetadataRoute } from "next";

const BASE_URL = "https://shelterdk.dk";

// Private/tekniske stier som INGEN bot skal indeksere.
const DISALLOW_PATHS = [
  "/admin/",
  "/api/",
  "/embed/",
  "/owner/",
  "/min-booking/",
  "/booking/",
  "/book/",
];

/**
 * Aggressive crawlere uden værdi for et dansk shelter-site. Bytespider
 * (ByteDance) og PetalBot (Huawei) crawler tungt fra datacenter-IP'er i
 * Asien (Singapore/Vietnam) uden at sende rigtige brugere eller drive
 * AI-citationer.
 *
 * BEVIDST IKKE blokeret:
 * - SEO-værktøjer ejeren selv bruger (Ahrefs, Semrush, Majestic/MJ12,
 *   Moz/DotBot, DataForSeo m.fl.) — de skal kunne crawle.
 * - AI-crawlere der driver citationer (GPTBot, OAI-SearchBot, ClaudeBot,
 *   PerplexityBot, Google-Extended).
 *
 * Den primære båndbredde-beskyttelse mod scrapers der IGNORERER robots.txt
 * håndteres på edge (Cloudflare foran Netlify), ikke her.
 */
const BLOCKED_BOTS = [
  "Bytespider",
  "PetalBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Alle øvrige bots (inkl. Google, Bing, og AI-citations-crawlere).
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      // Aggressive scrapers: helt blokeret.
      {
        userAgent: BLOCKED_BOTS,
        disallow: "/",
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
