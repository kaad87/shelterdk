import { describe, it, expect } from "vitest";
import { buildQuickAnswer } from "@/lib/quick-answer";

describe("buildQuickAnswer", () => {
  it("bygger fuld sætning med alle tal og dansk 'og' før sidste led", () => {
    expect(
      buildQuickAnswer("I Aarhus Kommune", { count: 29, bookable: 22, toilet: 14, water: 9 })
    ).toBe(
      "I Aarhus Kommune finder du 29 shelters, hvoraf 22 kan bookes, 14 har toilet og 9 har adgang til vand."
    );
  });

  it("udelader 0- og udeladte felter", () => {
    expect(buildQuickAnswer("På Bornholm", { count: 12, bookable: 0, toilet: 3 })).toBe(
      "På Bornholm finder du 12 shelters, hvoraf 3 har toilet."
    );
  });

  it("ingen hale når kun count er sat", () => {
    expect(buildQuickAnswer("I Jylland", { count: 120 })).toBe(
      "I Jylland finder du 120 shelters."
    );
  });

  it("bruger ental korrekt", () => {
    expect(buildQuickAnswer("I Læsø Kommune", { count: 1, bookable: 1 })).toBe(
      "I Læsø Kommune finder du 1 shelter, hvoraf 1 kan bookes."
    );
  });

  it("understøtter facet-substantiv (ental/flertal)", () => {
    expect(
      buildQuickAnswer("På Fyn", { count: 18, bookable: 5 }, "shelter med vand", "shelters med vand")
    ).toBe("På Fyn finder du 18 shelters med vand, hvoraf 5 kan bookes.");
  });

  it("håndterer tom-tilstand (0 shelters)", () => {
    expect(buildQuickAnswer("I Testby Kommune", { count: 0 })).toBe(
      "I Testby Kommune har vi endnu ikke registreret nogen shelters."
    );
  });

  it("samler to klausuler med 'og' (ingen komma)", () => {
    expect(buildQuickAnswer("I Jylland", { count: 50, bookable: 10, water: 20 })).toBe(
      "I Jylland finder du 50 shelters, hvoraf 10 kan bookes og 20 har adgang til vand."
    );
  });
});
