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

  it("springer en vare uden pris eller billede over", () => {
    expect(parseFeedXml(feed({ ...BASIS, nypris: "" }), "prooutdoor")).toHaveLength(0);
    expect(parseFeedXml(feed({ ...BASIS, billedurl: "" }), "prooutdoor")).toHaveLength(0);
  });

  it("giver en tom liste frem for at vaelte paa noget der ikke er et feed", () => {
    expect(parseFeedXml(Buffer.from("<html>502 Bad Gateway</html>", "latin1"), "prooutdoor")).toEqual([]);
  });
});
