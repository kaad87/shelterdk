import { describe, it, expect } from "vitest";
import { regionSlugRedirect } from "@/lib/region-slug-redirect";

describe("regionSlugRedirect", () => {
  it("bare region-hub: lang Sjælland → kort", () => {
    expect(regionSlugRedirect("/danmark/sjaelland-og-oeerne")).toBe("/danmark/sjaelland");
  });

  it("kommune under kort Sjælland → lang (hvor routen serverer)", () => {
    expect(regionSlugRedirect("/danmark/sjaelland/roskilde")).toBe("/danmark/sjaelland-og-oeerne/roskilde");
  });

  it("shelter under kort Sjælland → lang", () => {
    expect(regionSlugRedirect("/danmark/sjaelland/odsherred/shelter-x")).toBe(
      "/danmark/sjaelland-og-oeerne/odsherred/shelter-x"
    );
  });

  it("facet med lang Sjælland → kort", () => {
    expect(regionSlugRedirect("/shelter-med-toilet/sjaelland-og-oeerne")).toBe("/shelter-med-toilet/sjaelland");
    expect(regionSlugRedirect("/shelter-med-vand/sjaelland-og-oeerne")).toBe("/shelter-med-vand/sjaelland");
  });

  it("Fyn: lang form findes aldrig → kort, både hub, kommune og facet", () => {
    expect(regionSlugRedirect("/danmark/fyn-og-oeerne")).toBe("/danmark/fyn");
    expect(regionSlugRedirect("/danmark/fyn-og-oeerne/langeland")).toBe("/danmark/fyn/langeland");
    expect(regionSlugRedirect("/shelter-med-hund/fyn-og-oeerne")).toBe("/shelter-med-hund/fyn");
  });

  it("gyldige stier røres IKKE (ingen redirect → null)", () => {
    // region-hub på kort form (kanonisk)
    expect(regionSlugRedirect("/danmark/sjaelland")).toBeNull();
    // kommune/shelter på lang form (kanonisk for de routes)
    expect(regionSlugRedirect("/danmark/sjaelland-og-oeerne/odsherred")).toBeNull();
    expect(regionSlugRedirect("/danmark/sjaelland-og-oeerne/odsherred/shelter-x")).toBeNull();
    // facet på kort form (kanonisk)
    expect(regionSlugRedirect("/shelter-med-vand/sjaelland")).toBeNull();
    // andre regioner urørt
    expect(regionSlugRedirect("/danmark/jylland")).toBeNull();
    expect(regionSlugRedirect("/danmark/jylland/aarhus")).toBeNull();
    expect(regionSlugRedirect("/danmark/fyn")).toBeNull();
    expect(regionSlugRedirect("/")).toBeNull();
  });

  it("undgår loop: output kan ikke selv matche en modsat regel", () => {
    // kort kommune → lang; den lange må IKKE matche kort-reglen igen
    const out = regionSlugRedirect("/danmark/sjaelland/roskilde");
    expect(out).not.toBeNull();
    expect(regionSlugRedirect(out!)).toBeNull();
  });
});
