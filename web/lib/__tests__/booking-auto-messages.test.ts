import { describe, it, expect } from "vitest";
import { applyMessagePlaceholders } from "@/lib/booking-email";

describe("applyMessagePlaceholders", () => {
  const base = {
    guestName: "Lars Andersen",
    shelterTitle: "Ørnebjerg Shelter",
    checkIn: "2026-05-22",
    checkOut: "2026-05-24",
    guestCount: 3,
  };

  it("replaces {gæst_navn}", () => {
    expect(applyMessagePlaceholders("Hej {gæst_navn}!", base)).toBe("Hej Lars Andersen!");
  });

  it("replaces {shelter_navn}", () => {
    expect(applyMessagePlaceholders("{shelter_navn}", base)).toBe("Ørnebjerg Shelter");
  });

  it("replaces {antal_nætter} correctly", () => {
    // 22 May → 24 May = 2 nights
    expect(applyMessagePlaceholders("{antal_nætter}", base)).toBe("2");
  });

  it("replaces {antal_personer}", () => {
    expect(applyMessagePlaceholders("{antal_personer}", base)).toBe("3");
  });

  it("replaces all placeholders in one pass", () => {
    const template = "{gæst_navn} booker {shelter_navn} — {antal_nætter} nætter for {antal_personer}";
    const result = applyMessagePlaceholders(template, base);
    expect(result).toContain("Lars Andersen");
    expect(result).toContain("Ørnebjerg Shelter");
    expect(result).toContain("2");
    expect(result).toContain("3");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(applyMessagePlaceholders("{ukendt_felt}", base)).toBe("{ukendt_felt}");
  });

  it("replaces {ankomst_dato} with Danish short format", () => {
    const result = applyMessagePlaceholders("{ankomst_dato}", base);
    // "fre. 22. maj" — weekday short + day + month long in da-DK
    expect(result).toMatch(/\d+\./); // has a day number
    expect(result.toLowerCase()).toContain("maj");
  });

  it("handles XSS in guest name (HTML context)", () => {
    const xss = { ...base, guestName: "<script>alert(1)</script>" };
    const result = applyMessagePlaceholders("Hej {gæst_navn}!", xss);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("handles XSS in shelter title (HTML context)", () => {
    const xss = { ...base, shelterTitle: `Shelter <b>X</b> & "Y"` };
    const result = applyMessagePlaceholders("{shelter_navn}", xss);
    expect(result).toContain("&lt;b&gt;");
    expect(result).toContain("&amp;");
    expect(result).toContain("&quot;");
  });
});
