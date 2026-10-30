import { describe, expect, it } from "vitest";
import { parseFeedXml, parseFeedCsv, csvFelter, awinPris } from "@/lib/parseAffiliateFeed";

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

/* ------------------------------------------------------------------ Awin-CSV */

const AWIN_HEAD =
  "aw_product_id,aw_deep_link,merchant_image_url,brand_name,merchant_category,product_name,description,search_price,custom_1,in_stock,is_for_sale";

/** Bygger et Awin-CSV med de kolonner synken beder om. */
function csv(...raekker: string[]): Buffer {
  return Buffer.from([AWIN_HEAD, ...raekker].join("\n"), "utf8");
}

describe("csvFelter", () => {
  it("deler paa komma uden for citationstegn", () => {
    expect(csvFelter("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("lader komma i et citeret felt staa", () => {
    // Produktnavne og beskrivelser er fulde af komma, og feedet er
    // komma-separeret. Uden citat-reglen ville hver beskrivelse skubbe
    // kolonnerne til hoejre, og prisen ville blive laest fra et andet felt.
    expect(csvFelter('1,"Sovepose, dun, -5 grader",299')).toEqual([
      "1",
      "Sovepose, dun, -5 grader",
      "299",
    ]);
  });

  it("laeser et dobbelt citationstegn som ét tegn", () => {
    expect(csvFelter('"Telt 2,5"" bund",1')).toEqual(['Telt 2,5" bund', "1"]);
  });

  it("giver et tomt felt til sidst naar linjen ender paa komma", () => {
    expect(csvFelter("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("awinPris", () => {
  it("tager custom_1 og ikke search_price", () => {
    // Faelden i feedet: felterne staar omvendt af Awins konvention.
    // Bergans Flya staar med 2439 i search_price og 1220 i custom_1, og
    // butikken tager 1220. En almindelig Awin-integration havde vist 2439.
    expect(awinPris("2439.00", "1220.00")).toBe(1220);
  });

  it("falder tilbage paa search_price naar custom_1 er tom", () => {
    expect(awinPris("499.00", "")).toBe(499);
    expect(awinPris("499.00", "0.00")).toBe(499);
  });

  it("laeser komma som decimaltegn", () => {
    expect(awinPris("", "106,62")).toBeCloseTo(106.62);
  });

  it("giver null naar ingen af felterne er en pris", () => {
    expect(awinPris("", "")).toBeNull();
    expect(awinPris("gratis", "-")).toBeNull();
  });
});

describe("parseFeedCsv", () => {
  const raekke =
    '12345,https://awin.example/p/1,https://img.example/1.jpg,Bergans,Tunneltelte,"Bergans Trollhetta 3",' +
    '"Et tunneltelt til tre, 3,1 kg",2439.00,1220.00,1,1';

  it("laeser en raekke til en vare", () => {
    const [p] = parseFeedCsv(csv(raekke), "outnorth");
    expect(p.id).toBe("outnorth-12345");
    expect(p.retailer).toBe("outnorth");
    expect(p.brand).toBe("Bergans");
    expect(p.product_name).toBe("Bergans Trollhetta 3");
    expect(p.category_raw).toBe("Tunneltelte");
    expect(p.price).toBe(1220);
    expect(p.in_stock).toBe(true);
  });

  it("saetter aldrig en foer-pris", () => {
    // Den vejledende udsalgspris er kendt, men den er ikke den pris butikken
    // faktisk solgte til. Med den som foer-pris ville 61 % af kataloget staa
    // som nedsat paa /tilbud og /black-friday og fortraenge de andre
    // forhandleres rigtige nedsaettelser.
    const [p] = parseFeedCsv(csv(raekke), "outnorth");
    expect(p.price_original).toBeNull();
    expect(p.discount_pct).toBeNull();
  });

  it("springer varer over der ikke er til salg", () => {
    const udgaaet = raekke.replace(/,1$/, ",0");
    expect(parseFeedCsv(csv(udgaaet), "outnorth")).toHaveLength(0);
  });

  it("springer varer uden billede, navn eller pris over", () => {
    const udenBillede = raekke.replace("https://img.example/1.jpg", "");
    const udenPris = raekke.replace("2439.00,1220.00", ",");
    expect(parseFeedCsv(csv(udenBillede), "outnorth")).toHaveLength(0);
    expect(parseFeedCsv(csv(udenPris), "outnorth")).toHaveLength(0);
  });

  it("springer afkortede linjer over frem for at laese felterne forskudt", () => {
    expect(parseFeedCsv(csv("12345,https://awin.example/p/1"), "outnorth")).toHaveLength(0);
  });

  it("giver en tom liste frem for at vaelte paa noget der ikke er et feed", () => {
    expect(parseFeedCsv(Buffer.from("502 Bad Gateway", "utf8"), "outnorth")).toEqual([]);
    expect(parseFeedCsv(Buffer.from("", "utf8"), "outnorth")).toEqual([]);
  });
});
