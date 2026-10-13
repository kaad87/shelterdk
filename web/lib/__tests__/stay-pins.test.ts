import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * En falsk query-builder der husker hvilke filtre der blev sat.
 *
 * Reglen "kun pins hvis stedet findes paa Booking" er en kaede af fire
 * filtre. Testen skal fange, hvis ét af dem falder ud ved en omskrivning, og
 * det kan den kun ved at se paa hvad der faktisk blev sendt til databasen.
 */
function fakeSupabase(rows: unknown[]) {
  const filtre: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const navn of ["select", "eq", "in", "not", "neq"]) {
    builder[navn] = vi.fn((...args: unknown[]) => {
      filtre.push(`${navn}(${args.join(",")})`);
      return builder;
    });
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
  return { klient: { from: vi.fn(() => builder) }, filtre };
}

const række = (over: Record<string, unknown> = {}) => ({
  id: 1, slug: "x", name: "Hillerød Camping", type: "campingplads",
  location: "POINT(12.29 55.92)", price_from: null, image_url: null,
  booking_url: "https://www.booking.com/hotel/dk/x.html",
  link_source: "booking_com", ...over,
});

beforeEach(() => vi.resetModules());

async function hentPins(rows: unknown[]) {
  const { klient, filtre } = fakeSupabase(rows);
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => klient }));
  const { getPublishedStayPins } = await import("@/lib/nature-stays");
  return { pins: await getPublishedStayPins(), filtre };
}

describe("getPublishedStayPins", () => {
  it("kraever alle fire betingelser, saa en pin ikke kan opstaa uden et link", async () => {
    // OSM ved ikke hvilke steder der ligger paa Booking. Uden link er en pin
    // et loefte sitet ikke kan indfri: brugeren klikker og faar ingenting.
    const { filtre } = await hentPins([række()]);
    expect(filtre).toContain("eq(status,published)");
    expect(filtre).toContain("in(link_source,booking_com)");
    expect(filtre.some((f) => f.startsWith("not(booking_url"))).toBe(true);
    expect(filtre).toContain("neq(booking_url,)");
    expect(filtre.some((f) => f.startsWith("not(location"))).toBe(true);
  });

  it("henter link_source med, saa knappen kan faa den rigtige etiket", async () => {
    const { pins, filtre } = await hentPins([række()]);
    expect(filtre[0]).toContain("link_source");
    expect(pins[0].link_source).toBe("booking_com");
  });

  it("laeser koordinaterne i den rigtige raekkefoelge", async () => {
    // WKT er POINT(lng lat). Byttet om havner hele Danmark i Somalia.
    const { pins } = await hentPins([række()]);
    expect(pins[0].lng).toBeCloseTo(12.29);
    expect(pins[0].lat).toBeCloseTo(55.92);
  });

  it("springer en raekke over, hvis dens location ikke kan laeses", async () => {
    const { pins } = await hentPins([række({ location: "ikke en WKT" })]);
    expect(pins).toHaveLength(0);
  });

  it("tager typen med, saa markoeren kan vaelge sin glyf", async () => {
    const { pins } = await hentPins([række({ type: "hytte" })]);
    expect(pins[0].type).toBe("hytte");
  });

  it("tager imod et tomt svar uden at kaste", async () => {
    const { pins } = await hentPins([]);
    expect(pins).toEqual([]);
  });
});
