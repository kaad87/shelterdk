import { describe, it, expect } from "vitest";
import { brugbartBillede } from "../affiliate-billede";

/**
 * URL'erne herunder er de faktiske vaerdier fra feedet den 14. november 2026.
 * De doede er verificeret med GET (ikke kun HEAD) og svarede alle 404; de
 * levende svarede alle 200. Se lib/affiliate-billede.ts for maalingen.
 */
const DOEDE = [
  "https://backpackerlife.dk/wp-content/uploads/2025/02/Dry-bag-med-kompression- - -Sea-to-Summit-Evac- - -8-liter-1-1.png",
  "https://backpackerlife.dk/wp-content/uploads/2023/03/Dunsovepose- - -Nordisk-Phantom-220- - -Left-Zip- - -XL.png",
  "https://backpackerlife.dk/wp-content/uploads/2025/10/Gaiters- - -Black-Diamond-Frontpoint-GTX-V2- - -Sort-6.png",
  "https://backpackerlife.dk/wp-content/uploads/2022/02/Spork- - -Light-My-Fire-Original-BIO-8.jpg",
  "https://backpackerlife.dk/wp-content/uploads/2025/06/Vandrestave- - -Highlander-Mull-4.jpg",
];

const LEVENDE = [
  "https://backpackerlife.dk/wp-content/uploads/2023/10/Stol-Treklife-High-back-UL-Chair-1.jpg",
  "https://backpackerlife.dk/wp-content/uploads/2022/01/Vandresokker-Highlander-Crusader-Groen-1.png",
];

describe("brugbartBillede", () => {
  it("kasserer hver eneste af de URL'er der faktisk var doede", () => {
    for (const u of DOEDE) expect(brugbartBillede(u)).toBeNull();
  });

  it("beholder de URL'er der faktisk virkede", () => {
    for (const u of LEVENDE) expect(brugbartBillede(u)).toBe(u);
  });

  it("kasserer tom, kun-mellemrum og manglende", () => {
    expect(brugbartBillede("")).toBeNull();
    expect(brugbartBillede("   ")).toBeNull();
    expect(brugbartBillede(null)).toBeNull();
    expect(brugbartBillede(undefined)).toBeNull();
  });

  it("trimmer uden at kassere", () => {
    expect(brugbartBillede("  https://x.dk/a.jpg  ")).toBe("https://x.dk/a.jpg");
  });

  it("roerer ikke et KODET mellemrum", () => {
    // %20 er en gyldig, fungerende URL. Kasserede vi den, ville vi smide
    // billeder vaek fra enhver butik der koder sine filnavne korrekt.
    const u = "https://x.dk/Dry%20bag.jpg";
    expect(brugbartBillede(u)).toBe(u);
  });

  it("fanger ogsaa tabulator og linjeskift", () => {
    // Et feed kan sende hvad som helst. Alle hvide tegn er lige ugyldige i
    // en URL, og et linjeskift midt i en sti er lige saa doedt som et
    // mellemrum — men ville slippe igennem en regel der kun saa efter " ".
    expect(brugbartBillede("https://x.dk/a\tb.jpg")).toBeNull();
    expect(brugbartBillede("https://x.dk/a\nb.jpg")).toBeNull();
  });

  it("gaelder alle forhandlere, ikke kun backpackerlife", () => {
    // Reglen er RFC 3986, ikke en kendsgerning om én butik. Naesten alle
    // doede URL'er er backpackerlifes i dag, men den naeste butik der
    // bygger filnavne ud af varetitler skal daekkes uden en kodeaendring.
    expect(brugbartBillede("https://outmore.dk/media/Telt - 2 personer.jpg")).toBeNull();
  });
});
