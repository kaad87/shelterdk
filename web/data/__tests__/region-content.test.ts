import { describe, it, expect } from "vitest";
import { getRegionContent, regionDisplayName } from "@/data/region-content";
import { REGION_NAMES } from "@/lib/cross-page-config";

describe("getRegionContent", () => {
  it("finder indhold for DB-regionsnavnet 'Sjælland og Øerne' (ikke kun 'Sjælland')", () => {
    const c = getRegionContent("Sjælland og Øerne");
    expect(c).not.toBeNull();
    expect(c!.sections.length).toBeGreaterThanOrEqual(3);
  });

  it("har indhold for hvert DB-regionsnavn", () => {
    for (const name of Object.values(REGION_NAMES)) {
      expect(getRegionContent(name), name).not.toBeNull();
    }
  });

  it("Sjælland-sektionerne dækker landsdelene folk søger på", () => {
    const text = getRegionContent("Sjælland og Øerne")!.sections.map((s) => s.heading + " " + s.text).join(" ");
    expect(text).toMatch(/Nordsjælland/);
    expect(text).toMatch(/Sydsjælland|Møn/);
    expect(text).toMatch(/Vestsjælland|Odsherred/);
  });
});

describe("regionDisplayName", () => {
  it("bruger den korte form folk søger på i titel/H1", () => {
    expect(regionDisplayName("Sjælland og Øerne")).toBe("Sjælland");
    expect(regionDisplayName("Jylland")).toBe("Jylland");
  });
});
