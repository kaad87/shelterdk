import { describe, it, expect } from "vitest";
import { slimShelterForList, slimSheltersForList } from "@shared/lib/shelter-list-slim";
import { getCity, getPetsAllowed, getWater } from "@shared/lib/shelter-detail";
import type { Shelter } from "@shared/types/shelter";

/**
 * Slankningen må ikke ændre hvad kortene VISER — kun hvor beregningen sker.
 * Testene sammenligner derfor getternes svar før og efter.
 */
function base(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "1",
    slug: "test",
    title: "Test",
    place: null,
    kommune: null,
    region: "Jylland",
    water: null,
    geofa_raw: {},
    ...overrides,
  } as Shelter;
}

describe("slimShelterForList", () => {
  it("fjerner geofa_raw — det er hele pointen", () => {
    const s = slimShelterForList(base({ geofa_raw: { postnr_by: "8000 Aarhus" } }));
    expect("geofa_raw" in s).toBe(false);
  });

  it("bevarer byen der ellers kun kunne udledes af geofa_raw", () => {
    const foer = base({ geofa_raw: { postnr_by: "6920 Videbæk" } });
    expect(getCity(foer)).toBe("Videbæk");
    expect(getCity(slimShelterForList(foer))).toBe("Videbæk");
  });

  it("bevarer hunde-oplysningen fra geofa_raw", () => {
    const ja = base({ geofa_raw: { hunde_tilladt: "Ja" } });
    expect(getPetsAllowed(ja)).toBe(true);
    expect(getPetsAllowed(slimShelterForList(ja))).toBe(true);

    const nej = base({ geofa_raw: { hunde_tilladt: "Nej" } });
    expect(getPetsAllowed(nej)).toBe(false);
    expect(getPetsAllowed(slimShelterForList(nej))).toBe(false);
  });

  it("skelner mellem 'ukendt' og 'ikke tilladt'", () => {
    // Kritisk: null må ikke blive til false, ellers ville alle de 1.673 shelters
    // uden hunde-oplysning se ud som om hunde er forbudt.
    const ukendt = slimShelterForList(base({ geofa_raw: {} }));
    expect(getPetsAllowed(ukendt)).toBeNull();
    expect(getPetsAllowed(slimShelterForList(base({ geofa_raw: { hund: "Nej" } })))).toBe(false);
  });

  it("rører ikke water — den læses fra kolonnen, ikke geofa_raw", () => {
    expect(getWater(slimShelterForList(base({ water: true })))).toBe(true);
    expect(getWater(slimShelterForList(base({ water: false })))).toBe(false);
  });

  it("foretrækker place/kommune over geofa_raw, som getCity altid har gjort", () => {
    const s = base({ place: "Ebeltoft", geofa_raw: { postnr_by: "8000 Aarhus" } });
    expect(getCity(slimShelterForList(s))).toBe(getCity(s));
  });

  it("lader alle øvrige felter være urørt", () => {
    const s = base({ title: "Janum Kjøt", capacity: 5, water: true, geofa_raw: { x: 1 } });
    const slanket = slimShelterForList(s);
    expect(slanket.title).toBe("Janum Kjøt");
    expect(slanket.capacity).toBe(5);
    expect(slanket.water).toBe(true);
    expect(slanket.id).toBe(s.id);
  });

  it("slimSheltersForList behandler hele listen", () => {
    const list = slimSheltersForList([
      base({ id: "a", geofa_raw: { postnr_by: "6920 Videbæk" } }),
      base({ id: "b", geofa_raw: { hunde_tilladt: "Ja" } }),
    ]);
    expect(list).toHaveLength(2);
    expect(list.every((s) => !("geofa_raw" in s))).toBe(true);
    expect(getCity(list[0])).toBe("Videbæk");
    expect(getPetsAllowed(list[1])).toBe(true);
  });
});
