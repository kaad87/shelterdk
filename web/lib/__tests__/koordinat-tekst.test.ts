import { describe, expect, it } from "vitest";
import { laesKoordinat, erIDanmark } from "@/lib/koordinat-tekst";

describe("laesKoordinat", () => {
  it("laeser 'Kopiér koordinater' fra Google Maps", () => {
    const k = laesKoordinat("55.924147, 12.296374")!;
    expect(k.lat).toBeCloseTo(55.924147);
    expect(k.lng).toBeCloseTo(12.296374);
    expect(k.byttet).toBe(false);
  });

  it("tager det uden mellemrum og med semikolon", () => {
    expect(laesKoordinat("55.924147,12.296374")!.lat).toBeCloseTo(55.924147);
    expect(laesKoordinat("55.924147; 12.296374")!.lng).toBeCloseTo(12.296374);
    expect(laesKoordinat("55.924147 12.296374")!.lng).toBeCloseTo(12.296374);
  });

  it("laeser grader, minutter og sekunder", () => {
    // Googles anden visning i samme hoejreklik-menu.
    const k = laesKoordinat("55°55'26.9\"N 12°17'46.9\"E")!;
    expect(k.lat).toBeCloseTo(55.9241, 3);
    expect(k.lng).toBeCloseTo(12.2964, 3);
  });

  it("laeser koordinaterne ud af en Google Maps-adresse", () => {
    const k = laesKoordinat("https://www.google.com/maps/@55.924147,12.296374,15z")!;
    expect(k.lat).toBeCloseTo(55.924147);
    expect(k.lng).toBeCloseTo(12.296374);
  });

  it("laeser dem ogsaa fra et laengere place-link", () => {
    const u = "https://www.google.com/maps/place/Hiller%C3%B8d+Camping/@55.924147,12.296374,17z"
      + "/data=!3m1!4b1!4m6!3m5!1s0x465252!8m2!3d55.924147!4d12.296374";
    const k = laesKoordinat(u)!;
    expect(k.lat).toBeCloseTo(55.924147);
    expect(k.lng).toBeCloseTo(12.296374);
  });

  it("bytter om, naar tallene staar omvendt", () => {
    // 12,29 kan ikke vaere en breddegrad i Danmark, og en ombyttet koordinat
    // lander stedet i Somalia uden at nogen opdager det: kortet viser bare hav.
    const k = laesKoordinat("12.296374, 55.924147")!;
    expect(k.lat).toBeCloseTo(55.924147);
    expect(k.lng).toBeCloseTo(12.296374);
    expect(k.byttet).toBe(true);
  });

  it("bytter ikke om paa et gyldigt udenlandsk punkt uden grund", () => {
    // Berlin: 52,52 / 13,40. Begge ligger uden for DK, men raekkefoelgen er rigtig.
    const k = laesKoordinat("52.5200, 13.4050")!;
    expect(k.lat).toBeCloseTo(52.52);
    expect(k.byttet).toBe(false);
  });

  it("siger fra over for et kort dele-link, i stedet for at gaette", () => {
    // Det skal foelges for at finde stedet, og det goer vi ikke.
    expect(laesKoordinat("https://maps.app.goo.gl/xYz123")).toBeNull();
  });

  it("kraever decimaler, saa to tilfaeldige tal ikke bliver til et sted", () => {
    expect(laesKoordinat("2, 3")).toBeNull();
    expect(laesKoordinat("12 personer, 3 shelters")).toBeNull();
  });

  it("afviser tal der ikke kan vaere koordinater", () => {
    expect(laesKoordinat("200.5, 300.5")).toBeNull();
    expect(laesKoordinat("")).toBeNull();
    expect(laesKoordinat("ikke koordinater")).toBeNull();
  });
});

describe("erIDanmark", () => {
  it("kender Danmarks udstraekning inkl. Bornholm", () => {
    expect(erIDanmark(55.92, 12.29)).toBe(true);   // Hillerød
    expect(erIDanmark(55.21, 14.90)).toBe(true);   // Bornholm
    expect(erIDanmark(57.59, 10.54)).toBe(true);   // Skagen
    expect(erIDanmark(52.52, 13.40)).toBe(false);  // Berlin
  });
});
