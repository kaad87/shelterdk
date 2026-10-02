import { describe, it, expect } from "vitest";
import { gearSuggestionHref } from "@/lib/gear-suggestions";

describe("gearSuggestionHref", () => {
  it("mærker linket med hvor det kommer fra, så affiliate-klik kan henføres", () => {
    expect(gearSuggestionHref("sovepose")).toBe("/bedste/sovepose?fra=shelter");
  });

  it("afviser slugs der ikke ligner et guide-slug", () => {
    expect(() => gearSuggestionHref("../admin")).toThrow();
    expect(() => gearSuggestionHref("a b")).toThrow();
  });
});
