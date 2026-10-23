import { describe, expect, it } from "vitest";
import { parseFeedXml } from "@/lib/parseAffiliateFeed";

/** Bygger et feed som Partner-ads leverer det: latin1 og uden mellemrum. */
function feed(felter: Record<string, string>): Buffer {
  const krop = Object.entries(felter)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="iso-8859-1"?><produkter><produkt>${krop}</produkt></produkter>`;
  return Buffer.from(xml, "latin1");
}

const BASIS = {
  produktid: "1",
  produktnavn: "Testvare",
  billedurl: "https://example.com/b.jpg",
  vareurl: "https://example.com/v",
  nypris: "499,00".replace(",", "."),
  lagerantal: "5",
};

describe("parseFeedXml", () => {
  it("laeser danske bogstaver fra et latin1-feed", () => {
    const [p] = parseFeedXml(feed({ ...BASIS, produktnavn: "Sovepose til børn på ø" }), "prooutdoor");
    expect(p.product_name).toBe("Sovepose til børn på ø");
  });

  it("retter et dobbeltkodet gradtegn", () => {
    // Pro Outdoors feed er latin1, men gradtegnet er kommet igennem to gange
    // og staar som de to latin1-tegn "Â°". Det rammer baade brandnavnet
    // 66°North og alle temperaturangivelser i beskrivelserne.
    const raa = Buffer.from(
      `<?xml version="1.0" encoding="iso-8859-1"?><produkter><produkt>` +
        `<produktid>1</produktid><produktnavn>66Â°North Jakke</produktnavn>` +
        `<beskrivelse>Komfort ned til -10Â°C i praksis.</beskrivelse>` +
        `<billedurl>https://example.com/b.jpg</billedurl>` +
        `<vareurl>https://example.com/v</vareurl>` +
        `<nypris>499.00</nypris><lagerantal>5</lagerantal>` +
        `</produkt></produkter>`,
      "latin1"
    );
    const [p] = parseFeedXml(raa, "prooutdoor");
    expect(p.product_name).toBe("66°North Jakke");
    expect(p.description).toBe("Komfort ned til -10°C i praksis.");
  });

  it("roerer ikke et rent feed", () => {
    // Et enkelt gradtegn og et enkelt Â er ikke dobbeltkodning: reparationen
    // kraever at det foelgende tegn ligger i 0x80-0xBF, saa begge er fredet.
    const [p] = parseFeedXml(
      feed({ ...BASIS, produktnavn: "Jakke ° med Â i navnet", beskrivelse: "Græs og ål" }),
      "outdoornu"
    );
    expect(p.product_name).toBe("Jakke ° med Â i navnet");
    expect(p.description).toBe("Græs og ål");
  });

  it("retter trebyte-sekvenser, ikke kun tobyte", () => {
    // 34 produkter havde TM som tre tegn og 31 havde apostrof. Foerste udgave
    // af reparationen kendte kun tobyte-sekvenser og lod dem staa.
    const raa = Buffer.from(
      `<?xml version="1.0" encoding="iso-8859-1"?><produkter><produkt>` +
        `<produktid>1</produktid><produktnavn>Columbia Omni-Shade\u00e2\u0084\u00a2 Kasket</produktnavn>` +
        `<beskrivelse>Snugpaks \u00e2\u0080\u009cSleeper Lite\u00e2\u0080\u009d er en mumiepose, og den er -5\u00c2\u00b0C.</beskrivelse>` +
        `<billedurl>https://example.com/b.jpg</billedurl>` +
        `<vareurl>https://example.com/v</vareurl>` +
        `<nypris>499.00</nypris><lagerantal>5</lagerantal>` +
        `</produkt></produkter>`,
      "latin1"
    );
    const [p] = parseFeedXml(raa, "backpackerlife");
    expect(p.product_name).toBe("Columbia Omni-Shade\u2122 Kasket");
    expect(p.description).toBe("Snugpaks \u201cSleeper Lite\u201d er en mumiepose, og den er -5\u00b0C.");
  });

  it("fjerner WordPress-shortcodes fra beskrivelsen", () => {
    // 392 produkter begynder med [kad_youtube url="..."], og den stod raa paa
    // /bedste/stormkoekken midt i et produktkort.
    const [p] = parseFeedXml(
      feed({
        ...BASIS,
        beskrivelse: '[kad_youtube url="https://youtu.be/abc" width=560 height=315] Treklifes mumiepose er let.',
      }),
      "backpackerlife"
    );
    expect(p.description).toBe("Treklifes mumiepose er let.");
  });

  it("lader almindelig tekst i firkantparentes staa", () => {
    const [p] = parseFeedXml(
      feed({ ...BASIS, beskrivelse: "Sovepose [2 stk] i pakken. Str. [XL] findes." }),
      "backpackerlife"
    );
    expect(p.description).toBe("Sovepose [2 stk] i pakken. Str. [XL] findes.");
  });

  it("afkoder HTML-entiteter der er sluppet igennem som tekst", () => {
    // Outdoor I Centrum sender "&amp;bull;", som XML-parseren korrekt gør til
    // teksten "&bull;". Den stod raa paa produktkortet.
    const [p] = parseFeedXml(
      feed({ ...BASIS, beskrivelse: "&amp;bull; 18 cm savblad &amp;bull; Foldbart design 5&amp;deg;C" }),
      "outdooricentrum"
    );
    expect(p.description).toBe("\u2022 18 cm savblad \u2022 Foldbart design 5\u00b0C");
  });

  it("lader en ukendt entitet og et almindeligt og-tegn staa", () => {
    const [p] = parseFeedXml(
      feed({ ...BASIS, beskrivelse: "Salt &amp; peber. &amp;ukendtentitet; og 50 &amp; 60 cm." }),
      "outdooricentrum"
    );
    expect(p.description).toBe("Salt & peber. &ukendtentitet; og 50 & 60 cm.");
  });

  it("springer en vare uden pris eller billede over", () => {
    expect(parseFeedXml(feed({ ...BASIS, nypris: "" }), "prooutdoor")).toHaveLength(0);
    expect(parseFeedXml(feed({ ...BASIS, billedurl: "" }), "prooutdoor")).toHaveLength(0);
  });

  it("giver en tom liste frem for at vaelte paa noget der ikke er et feed", () => {
    expect(parseFeedXml(Buffer.from("<html>502 Bad Gateway</html>", "latin1"), "prooutdoor")).toEqual([]);
  });
});
