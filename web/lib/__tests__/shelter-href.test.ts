import { describe, it, expect } from "vitest";
import { shelterHref, NO_KOMMUNE_SLUG } from "@/lib/shelter-href";

describe("shelterHref", () => {
  it("giver den kanoniske silo-sti når region og kommune kendes", () => {
    // Samme eksempel som QA'en 19/11: /shelter/logismose-10073 svarede 308 hertil.
    expect(shelterHref({ slug: "logismose-10073", region: "Fyn", kommune: "Assens" })).toBe(
      "/danmark/fyn/assens/logismose-10073"
    );
  });

  it("slugificerer danske tegn i region og kommune", () => {
    expect(shelterHref({ slug: "s", region: "Sjælland", kommune: "Høje-Taastrup" })).toBe(
      "/danmark/sjaelland/hoeje-taastrup/s"
    );
  });

  it("falder tilbage til /shelter/ når region mangler eller er 'Danmark'", () => {
    expect(shelterHref({ slug: "s", region: null, kommune: "Aarhus" })).toBe("/shelter/s");
    expect(shelterHref({ slug: "s", region: "  ", kommune: null })).toBe("/shelter/s");
    expect(shelterHref({ slug: "s", region: "Danmark", kommune: "Aarhus" })).toBe("/shelter/s");
    expect(shelterHref({ slug: "s", region: "danmark", kommune: null })).toBe("/shelter/s");
  });

  it("bruger ukendt-kommune når region kendes men kommune ikke gør", () => {
    expect(shelterHref({ slug: "s", region: "Fyn", kommune: null })).toBe(
      `/danmark/fyn/${NO_KOMMUNE_SLUG}/s`
    );
    expect(shelterHref({ slug: "s", region: "Fyn", kommune: "   " })).toBe(
      `/danmark/fyn/${NO_KOMMUNE_SLUG}/s`
    );
  });
});
