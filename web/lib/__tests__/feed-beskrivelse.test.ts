import { describe, expect, it } from "vitest";
import { helTekst } from "@/lib/feed-beskrivelse";

/**
 * Fixtures er rigtige beskrivelser fra feedet, i deres fulde længde.
 *
 * Det er ikke pedanteri. Reglen bruger længden til at skelne en tekst feedet
 * har afkortet fra en komplet punktopstilling uden punktum, og feedet afkorter
 * ved 248-255 tegn. Testes der på korte, kunstige strenge, prøver man en sti
 * produktionen aldrig går — og en tidligere version af denne test gjorde
 * netop det og gav derfor grønt lys til en regel, der klippede et ord af
 * hver komplet spec-liste.
 */
const FYLD =
  "Slidstærkt materiale og gennemtestet konstruktion til brug på shelterture, " +
  "vandreture og campingpladser i dansk vejr hele året rundt uden besvær ";

/** Bygger en streng på feedets afkortningslængde, der slutter på `hale`. */
function somFeedet(hale: string): string {
  const mangler = 250 - hale.length;
  return (FYLD.repeat(4).slice(0, Math.max(0, mangler)) + hale).trim();
}

describe("helTekst — tekster der er hele", () => {
  it("lader en tekst der slutter med punktum stå urørt", () => {
    const t = "En emaljetallerken kan let vaskes op med sæbe og lunkent vand.";
    expect(helTekst(t)).toBe(t);
  });

  it("lader en komplet punktopstilling stå, selv uden sluttegn", () => {
    // Feedets lister har ikke et eneste punktum og slutter på sin sidste
    // værdi. Den er hel, og en reparation ville kun fjerne information.
    const t = "Mål: 160 x 80 cm Fremstillet af blødt microfiber Tørrer hurtigt Vægt: 450g";
    expect(helTekst(t)).toBe(t);
  });

  it("fjerner shortcodes fra feedet", () => {
    expect(helTekst('[kad_youtube url="https://youtu.be/x" width=560 ] High-Back UL stolen er let.'))
      .toBe("High-Back UL stolen er let.");
  });

  it("samler knækkede mellemrum", () => {
    expect(helTekst("To   linjer\n\nmed  luft imellem.")).toBe("To linjer med luft imellem.");
  });

  it("tåler tom tekst", () => {
    expect(helTekst(null)).toBeNull();
    expect(helTekst("   ")).toBeNull();
    expect(helTekst("Enkeltord")).toBeNull();
  });
});

describe("helTekst — tekster feedet har afkortet", () => {
  it("klipper tilbage til sidste hele sætning", () => {
    const t = somFeedet("Teltet er foldbart og vejer kun 1030 g, så det er nemt at medbringe. Den k");
    const ud = helTekst(t)!;
    expect(ud.endsWith("nemt at medbringe.")).toBe(true);
    expect(ud).not.toMatch(/Den k$/);
  });

  it("dropper en dinglende mærkat efter en værdi", () => {
    // "… Vægt: 300g Nedpakket st" — mærkaten mangler sin værdi.
    const ud = helTekst(somFeedet("til backpacking, sport og udendørsliv Vægt: 300g Nedpakket st"))!;
    expect(ud).toMatch(/Vægt: 300g$/);
  });

  it("dropper et dinglende ord i en opremsning uden punktum", () => {
    const ud = helTekst(somFeedet("Myggenet sikrer god ventilation og ingen insekter Justerbar"))!;
    expect(ud).toMatch(/ingen insekter$/);
  });

  it("dropper et efterladt tal uden enhed", () => {
    const ud = helTekst(somFeedet("1 stk: saks 1 stk: pincet 1 stk: trekantbandage 90 x"))!;
    expect(ud).toMatch(/trekantbandage$/);
  });

  it("dropper et hængende bindeord", () => {
    const ud = helTekst(somFeedet("pakker kompakt til festival, camping og stra"))!;
    expect(ud).toMatch(/camping$/);
  });

  it("respekterer en maksimumlængde og klipper stadig rent", () => {
    const t = "Første sætning her. Anden sætning her. Tredje sætning her.";
    expect(helTekst(t, 40)).toBe("Første sætning her. Anden sætning her.");
  });

  it("måler længden før shortcodes fjernes", () => {
    // Feedet afkorter ved ~255 tegn INKLUSIVE shortcoden, og en
    // [kad_youtube …] er omkring 88 tegn. Måles længden efter strip, står en
    // afkortet tekst kun til ~167 tegn og slap gennem længde-porten som "for
    // kort til at være afkortet". Det ramte 12 af de 202 beskrivelser
    // guiderne bruger — alle afkortet midt i et ord.
    const shortcode = '[kad_youtube url="https://www.youtube.com/watch?v=7bePwUNL5TE&t=161s" width=560 height=315 ] ';
    const hale = "Teltet har to separate sovekabiner og et stort opholdsrum i midten, som gi";
    const fyld = "Rummeligt familietelt til seks personer med gennemtestet konstruktion og limede syninger hele vejen rundt. ";
    const raa = shortcode + fyld + hale;
    expect(raa.replace(/\s+/g, " ").trim().length).toBeGreaterThan(240);
    expect(raa.replace(/\[[a-z_]+[^\]]*\]/gi, " ").replace(/\s+/g, " ").trim().length)
      .toBeLessThan(240);
    const ud = helTekst(raa)!;
    expect(ud).not.toMatch(/som gi$/);
    expect(ud).toMatch(/\.$/);
  });
});
