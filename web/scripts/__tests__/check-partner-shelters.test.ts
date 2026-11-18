import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { partnerAdsLinkFejl } from "../check-partner-shelters";
import { partnerAdsLink, PARTNER_SHELTERS } from "@/lib/partner-shelters";

describe("partnerAdsLinkFejl", () => {
  it("godkender de rigtige links for alle Sølund-varer", () => {
    for (const p of PARTNER_SHELTERS) {
      expect(partnerAdsLinkFejl(partnerAdsLink(p.url), p.url)).toBeNull();
    }
  });

  it("fanger et link der peger på en anden vare", () => {
    const a = "https://solundhuse.dk/produkt/shelter-udeliv/";
    const b = "https://solundhuse.dk/produkt/shelter-1-samlesaet-36-m2/";
    expect(partnerAdsLinkFejl(partnerAdsLink(a), b)).toMatch(/htmlurl/);
  });

  it("fanger forkert vært og manglende id'er", () => {
    const p = "https://solundhuse.dk/produkt/shelter-udeliv/";
    expect(partnerAdsLinkFejl(`https://example.com/dk/klikbanner.php?partnerid=1&bannerid=2&htmlurl=${p}`, p)).toMatch(/vært/);
    expect(partnerAdsLinkFejl(`https://www.partner-ads.com/dk/klikbanner.php?bannerid=2&htmlurl=${p}`, p)).toMatch(/partnerid/);
    expect(partnerAdsLinkFejl("ikke en url", p)).toMatch(/ugyldig/);
  });
});

describe("check-partner-shelters.ts", () => {
  // Et klik gennem partner-ads registreres hos annoncøren som et rigtigt klik.
  it("henter aldrig partner-ads-linket", () => {
    const kilde = readFileSync(join(__dirname, "../check-partner-shelters.ts"), "utf8");
    const kald = [...kilde.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1].trim());
    expect(kald.length).toBeGreaterThan(0);
    for (const arg of kald) {
      expect(arg).not.toMatch(/partnerAds|partner-ads|link|click/i);
    }
  });
});
