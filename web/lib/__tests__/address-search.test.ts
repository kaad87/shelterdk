import { describe, it, expect } from "vitest";
import { parseNominatimAddresses } from "@/lib/address-search";

const svar = [
  {
    display_name: "76, Ørsøvej, Ørsø, Dronninglund, Brønderslev Kommune, Region Nordjylland, 9330, Danmark",
    lat: "57.1766250",
    lon: "10.3300610",
    address: { house_number: "76", road: "Ørsøvej", village: "Ørsø", postcode: "9330", municipality: "Brønderslev Kommune" },
  },
  { display_name: "Uden koordinater", lat: "", lon: "", address: {} },
];

describe("parseNominatimAddresses", () => {
  it("bygger en dansk adresselinje af vej, nummer, postnr og by", () => {
    const [a] = parseNominatimAddresses(svar);
    expect(a.tekst).toBe("Ørsøvej 76, 9330 Ørsø");
    expect(a.lat).toBeCloseTo(57.176625, 5);
    expect(a.lon).toBeCloseTo(10.330061, 5);
    expect(a.place).toBe("Ørsø");
  });

  it("udelader resultater uden brugbare koordinater", () => {
    expect(parseNominatimAddresses(svar)).toHaveLength(1);
  });

  it("falder tilbage til display_name når adressedelene mangler", () => {
    const [a] = parseNominatimAddresses([
      { display_name: "Kalø Slotsruin, Syddjurs", lat: "56.29", lon: "10.49", address: {} },
    ]);
    expect(a.tekst).toBe("Kalø Slotsruin, Syddjurs");
  });
});
