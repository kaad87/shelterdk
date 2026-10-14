import { describe, expect, it } from "vitest";
import {
  STAY_TYPES, stayLabel, stayGlyph, stayMarkerHtml, PIN_FILL, PIN_GLYPH,
} from "@/lib/stay-types";

describe("stayLabel", () => {
  it("giver den rigtige etiket pr. type", () => {
    // Pop-up'en paa kortet skrev hardkodet "Glamping" om enhver type, ogsaa
    // om en campingplads. Det er hele grunden til at modulet findes.
    expect(stayLabel("campingplads")).toBe("Campingplads");
    expect(stayLabel("autocamperplads")).toBe("Autocamperplads");
    expect(stayLabel("hytte")).toBe("Hytte");
    expect(stayLabel("glamping")).toBe("Glamping");
  });

  it("kender de kuraterede typer tabellen oprindeligt blev bygget til", () => {
    expect(stayLabel("glamping_telt")).toBe("Glampingtelt");
    expect(stayLabel("luksus_shelter")).toBe("Luksus-shelter");
    expect(stayLabel("andet")).toBe("Naturophold");
  });

  it("viser en ukendt type som den staar frem for at skjule den", () => {
    // Et stille fald tilbage til "Naturophold" ville goere en forkert type
    // usynlig; staar der "vandrerhjem", kan nogen rette det.
    expect(stayLabel("vandrerhjem")).toBe("vandrerhjem");
  });
});

describe("stayGlyph", () => {
  it("giver hver af de fire typer sin egen glyf", () => {
    const glyphs = STAY_TYPES.map((t) => stayGlyph(t.key));
    expect(new Set(glyphs).size).toBe(STAY_TYPES.length);
  });

  it("laaner en glyf til de kuraterede typer i stedet for at efterlade dem tomme", () => {
    expect(stayGlyph("naturhytte")).toBe(stayGlyph("hytte"));
    expect(stayGlyph("dome")).toBe(stayGlyph("glamping"));
  });

  it("giver en ukendt type en glyf, saa pin'en findes paa kortet", () => {
    // Uden fald tilbage ville markoeren blive en tom cirkel.
    expect(stayGlyph("vandrerhjem")).toBe(stayGlyph("campingplads"));
  });
});

describe("stayMarkerHtml", () => {
  it("tegner en markoer med glyffen for typen", () => {
    const html = stayMarkerHtml("hytte", 28);
    expect(html).toContain(stayGlyph("hytte"));
    expect(html).toContain(PIN_FILL);
    expect(html).toContain(PIN_GLYPH);
    expect(html).toContain("28px");
  });

  it("holder glyffen inden for markoeren", () => {
    // 0,62 af 28 er 17: et ikon stoerre end cirklen ville staa uden for kanten.
    const html = stayMarkerHtml("campingplads", 28);
    const size = Number(html.match(/<svg width="(\d+)"/)![1]);
    expect(size).toBeLessThan(28);
    expect(size).toBeGreaterThan(12);
  });

  it("er skjult for skaermlaesere, fordi navnet staar i pop-up'en", () => {
    expect(stayMarkerHtml("glamping")).toContain('aria-hidden="true"');
  });
});

describe("glyffer for de typer der faktisk ligger i basen", () => {
  it("giver shelteret sin egen form, ikke husets", () => {
    // Da de foerste rigtige steder blev publiceret, saa fire af fem typer ens
    // ud paa kortet: luksus-shelter, tiny house, naturhytte og "andet" delte
    // alle hus-glyffen. Typeopdelingen tjente OSM-ordforraadet, ikke de steder
    // der faktisk ligger i basen.
    expect(stayGlyph("luksus_shelter")).not.toBe(stayGlyph("hytte"));
    expect(stayGlyph("luksus_shelter")).not.toBe(stayGlyph("campingplads"));
    expect(stayGlyph("andet")).not.toBe(stayGlyph("hytte"));
  });

  it("samler de smaa bygninger med vilje", () => {
    // En naturhytte, et traehus og et tiny house er alle en lille bygning med
    // tag. Fire hus-varianter ville vaere fire forskelle ingen kan se ved 28 px.
    expect(stayGlyph("naturhytte")).toBe(stayGlyph("hytte"));
    expect(stayGlyph("tiny_house")).toBe(stayGlyph("hytte"));
    expect(stayGlyph("traehus")).toBe(stayGlyph("hytte"));
  });

  it("samler glamping-varianterne", () => {
    expect(stayGlyph("glamping_telt")).toBe(stayGlyph("glamping"));
    expect(stayGlyph("dome")).toBe(stayGlyph("glamping"));
  });

  it("giver de ti typer seks forskellige former", () => {
    const typer = ["campingplads", "autocamperplads", "hytte", "glamping",
      "luksus_shelter", "tiny_house", "naturhytte", "andet", "glamping_telt", "dome"];
    expect(new Set(typer.map(stayGlyph)).size).toBe(6);
  });
});
