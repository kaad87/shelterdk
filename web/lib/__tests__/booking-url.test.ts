import { describe, expect, it } from "vitest";
import {
  laesBookingUrl, normaliserHvisBooking, sammeProperty,
  cjDeeplink, udpakCjDeeplink, udgaaendeLink,
} from "@/lib/booking-url";

// De faktiske adresser fra Booking, ikke opdigtede. Fixtures man selv har
// fundet paa er netop dem der ikke fanger problemet.
const ÆGTE = "https://www.booking.com/hotel/dk/shelter-slotsgaarden.da.html"
  + "?aid=356980&label=mkt123sc-92971863-5e41-4858-bd55-04705738b564"
  + "&sid=b04acae080e5fabe41dcf591c5b992b6&dest_id=-2744722&dest_type=city&dist=0"
  + "&group_adults=2&group_children=0&hapos=1&hpos=1&no_rooms=1&req_adults=2"
  + "&req_children=0&room1=A%2CA&sb_price_type=total&sr_order=popularity"
  + "&srepoch=1791901555&srpvid=c4e136776ae98216ef8b7418525641f6&type=total&ucfs=1&";

describe("laesBookingUrl", () => {
  it("fjerner sessions-id, fremmed partner-id og etiket", () => {
    // sid er personhenfoerbart og doer hurtigt. aid=356980 er ikke vores:
    // gemmes det, krediteres hver booking en anden.
    const r = laesBookingUrl(ÆGTE)!;
    expect(r.kanonisk).toBe("https://www.booking.com/hotel/dk/shelter-slotsgaarden.da.html");
    expect(r.kanonisk).not.toContain("sid=");
    expect(r.kanonisk).not.toContain("aid=");
    expect(r.fjernet).toEqual(expect.arrayContaining(["sid", "aid", "label"]));
  });

  it("siger hvor meget soegestoej der blev smidt vaek", () => {
    const r = laesBookingUrl(ÆGTE)!;
    expect(r.fjernet.some((f) => /søgeparametre/.test(f))).toBe(true);
    expect(ÆGTE.length - r.kanonisk.length).toBeGreaterThan(300);
  });

  it("tvinger dansk sprog, ogsaa naar linket er kopieret fra en engelsk session", () => {
    // Fire af de fem eksempler pegede paa en-gb.
    const r = laesBookingUrl(
      "https://www.booking.com/hotel/dk/shelter-i-sansehave.en-gb.html?aid=356980")!;
    expect(r.kanonisk).toBe("https://www.booking.com/hotel/dk/shelter-i-sansehave.da.html");
  });

  it("ser samme property bag to sprogvarianter", () => {
    const a = "https://www.booking.com/hotel/dk/shelter-slotsgaarden.da.html?sid=x";
    const b = "https://www.booking.com/hotel/dk/shelter-slotsgaarden.en-gb.html?aid=1";
    expect(sammeProperty(a, b)).toBe(true);
    expect(laesBookingUrl(a)!.kanonisk).toBe(laesBookingUrl(b)!.kanonisk);
  });

  it("klarer en adresse uden sprogled", () => {
    const r = laesBookingUrl("https://www.booking.com/hotel/dk/shelter-i-sansehave.html")!;
    expect(r.slug).toBe("shelter-i-sansehave");
  });

  it("holder landekoden, saa et svensk sted ikke bliver dansk", () => {
    expect(laesBookingUrl("https://www.booking.com/hotel/se/x.en-gb.html")!.land).toBe("se");
  });

  it("siger fra over for alt der ikke er en property-side", () => {
    // En stilfaerdig omskrivning af et link vi ikke forstod er vaerre end
    // at sige fra: et CJ-deeplink maa ikke blive til en kanonisk adresse
    // uden sporing.
    for (const u of [
      "https://www.booking.com/searchresults.da.html?dest_id=-2744722",
      "https://www.anrdoezrs.net/links/123/type/dlg/https://www.booking.com/hotel/dk/x.html",
      "https://landjord.dk/sted/x",
      "ikke en url",
      "",
    ]) {
      expect(laesBookingUrl(u), u).toBeNull();
    }
  });

  it("afviser et vaertsnavn der kun ligner booking.com", () => {
    expect(laesBookingUrl("https://booking.com.evil.example/hotel/dk/x.html")).toBeNull();
  });
});

describe("normaliserHvisBooking", () => {
  it("rydder op i en Booking-adresse", () => {
    expect(normaliserHvisBooking(ÆGTE))
      .toBe("https://www.booking.com/hotel/dk/shelter-slotsgaarden.da.html");
  });
  it("lader et CJ-deeplink staa uroert", () => {
    const cj = "https://www.anrdoezrs.net/links/123/type/dlg/https://www.booking.com/hotel/dk/x.html";
    expect(normaliserHvisBooking(cj)).toBe(cj);
  });
  it("trimmer mellemrum fra en indsat streng", () => {
    expect(normaliserHvisBooking("  https://landjord.dk/x  ")).toBe("https://landjord.dk/x");
  });
});

describe("cjDeeplink", () => {
  it("bygger linket i det format CJ selv genererer", () => {
    // Fra CJ's egen linkbygger, ShelterDK x Booking.com Nordics:
    // https://www.tkqlhce.com/click-101800945-15734870?url=<encoded>
    const d = cjDeeplink("https://www.booking.com/hotel/dk/shelter-i-sansehave.en-gb.html")!;
    expect(d.startsWith("https://www.tkqlhce.com/click-101800945-15734870?")).toBe(true);
    expect(d).toContain("url=https%3A%2F%2Fwww.booking.com%2Fhotel%2Fdk%2Fshelter-i-sansehave.da.html");
  });

  it("saetter placeringen som SID, saa indtjening kan goeres op pr. flade", () => {
    const d = cjDeeplink("https://www.booking.com/hotel/dk/x.da.html", "kort")!;
    expect(new URL(d).searchParams.get("sid")).toBe("kort");
  });

  it("udelader sid helt, naar der ikke er nogen", () => {
    const d = cjDeeplink("https://www.booking.com/hotel/dk/x.da.html")!;
    expect(d).not.toContain("sid=");
  });

  it("rydder op i destinationen foer den pakkes ind", () => {
    // Ellers ville sessions-id og fremmed aid rejse med indeni deeplinket.
    const d = cjDeeplink(ÆGTE, "side")!;
    const maal = new URL(d).searchParams.get("url")!;
    expect(maal).toBe("https://www.booking.com/hotel/dk/shelter-slotsgaarden.da.html");
    expect(maal).not.toContain("aid=");
    expect(maal).not.toContain("sid=b04acae");
  });

  it("bygger ikke et deeplink til noget der ikke er en Booking-property", () => {
    expect(cjDeeplink("https://landjord.dk/sted/x", "kort")).toBeNull();
  });
});

describe("udpakCjDeeplink", () => {
  it("finder destinationen i et faerdigt deeplink", () => {
    // Indsaetter nogen et faerdigt link, gemmer vi hellere destinationen og
    // bygger sporingen selv: et gemt deeplink har ét fast SID og kan ikke
    // skelne et klik paa kortet fra et klik paa en underside.
    const cj = "https://www.tkqlhce.com/click-101800945-15734870?url="
      + "https%3A%2F%2Fwww.booking.com%2Fhotel%2Fdk%2Fshelter-i-sansehave.en-gb.html";
    expect(udpakCjDeeplink(cj))
      .toBe("https://www.booking.com/hotel/dk/shelter-i-sansehave.en-gb.html");
  });

  it("giver null for alt der ikke er en CJ-klikadresse", () => {
    expect(udpakCjDeeplink("https://www.booking.com/hotel/dk/x.da.html")).toBeNull();
    expect(udpakCjDeeplink("https://landjord.dk/x")).toBeNull();
    expect(udpakCjDeeplink("ikke en url")).toBeNull();
  });
});

describe("udgaaendeLink", () => {
  it("pakker en Booking-adresse i CJ med placeringens SID", () => {
    const l = udgaaendeLink("https://www.booking.com/hotel/dk/x.da.html", "shelter")!;
    expect(l).toContain("tkqlhce.com");
    expect(new URL(l).searchParams.get("sid")).toBe("shelter");
  });

  it("lader et link uden for Booking gaa uroert igennem", () => {
    // Vi har ingen sporing paa Landjord, og et link vi ikke forstod maa ikke
    // omskrives.
    expect(udgaaendeLink("https://landjord.dk/sted/x", "kort")).toBe("https://landjord.dk/sted/x");
  });

  it("giver null, naar der ikke er noget link", () => {
    expect(udgaaendeLink(null, "kort")).toBeNull();
    expect(udgaaendeLink("", "kort")).toBeNull();
  });
});
