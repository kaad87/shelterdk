import { describe, expect, it } from "vitest";
import { helTekst } from "@/lib/feed-beskrivelse";

describe("helTekst", () => {
  it("lader en tekst der slutter rent stå urørt", () => {
    const t = "En foldestol der vejer 1.030 g. Den pakker lille.";
    expect(helTekst(t)).toBe(t);
  });

  it("klipper tilbage til sidste hele sætning", () => {
    expect(helTekst(
      "Stolen er foldbar og vejer kun 1030 g, hvorfor den er nem at medbringe. Den k"))
      .toBe("Stolen er foldbar og vejer kun 1030 g, hvorfor den er nem at medbringe.");
  });

  it("dropper det afskårne ord og det hængende bindeord", () => {
    // Her ligger sidste grænse efter "to personer." inden for de 40 tegn, så
    // den bruges ikke; i stedet ryger "stra" og derefter "og", som teksten
    // ellers ville ende på.
    const t = "Plads til to. Slidstærkt Oxford-stof og kraftig aluminiumsramme "
      + "der foldes hurtigt sammen og pakker kompakt til festival, camping og stra";
    expect(helTekst(t)).toBe(
      "Plads til to. Slidstærkt Oxford-stof og kraftig aluminiumsramme "
      + "der foldes hurtigt sammen og pakker kompakt til festival, camping");
  });

  it("bevarer en spec-liste i stedet for at skære den ned til første mål", () => {
    const t = "Ekstra robust festivalstol med 2 kopholdere. Stærkt stål med kapacitet på "
      + "150 kg og fastmonteret bærerem til at tage med. Vægt 3,5 kg. Sammenfoldet 87 x 14 x 12 cm";
    // Sidste grænse er "3,5 kg." og ligger sent nok, så målene i halen ryger —
    // men teksten slutter helt, og intet er klippet midt i et ord.
    expect(helTekst(t)).toBe(
      "Ekstra robust festivalstol med 2 kopholdere. Stærkt stål med kapacitet på "
      + "150 kg og fastmonteret bærerem til at tage med. Vægt 3,5 kg.");
  });

  it("fjerner shortcodes fra feedet", () => {
    expect(helTekst('[kad_youtube url="https://youtu.be/x" width=560 ] High-Back UL stolen er let.'))
      .toBe("High-Back UL stolen er let.");
  });

  it("samler knækkede mellemrum", () => {
    expect(helTekst("To   linjer\n\nmed  luft imellem.")).toBe("To linjer med luft imellem.");
  });

  it("giver null når der intet brugbart er", () => {
    expect(helTekst(null)).toBeNull();
    expect(helTekst("   ")).toBeNull();
    expect(helTekst("Enkeltord")).toBeNull();
  });

  it("respekterer en maksimumlængde og klipper stadig rent", () => {
    const t = "Første sætning her. Anden sætning her. Tredje sætning her.";
    expect(helTekst(t, 40)).toBe("Første sætning her. Anden sætning her.");
  });
});
