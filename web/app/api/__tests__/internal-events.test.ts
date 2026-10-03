import { describe, it, expect } from "vitest";
import { INTERNAL_EVENTS, internalEventRow } from "@/lib/internal-events";

describe("INTERNAL_EVENTS", () => {
  it("omfatter grej-blokkens klik", () => {
    expect(INTERNAL_EVENTS.has("gear_suggestion_click")).toBe(true);
  });
  it("omfatter ikke affiliate_click — den har sin egen tabel", () => {
    expect(INTERNAL_EVENTS.has("affiliate_click")).toBe(false);
  });
});

describe("internalEventRow", () => {
  it("bevarer eventnavn, sti og parametre", () => {
    const r = internalEventRow("gear_suggestion_click", { guide_slug: "sovepose", shelter_slug: "x-1" }, "/danmark/a/b/c");
    expect(r).toEqual({
      event: "gear_suggestion_click",
      path: "/danmark/a/b/c",
      params: { guide_slug: "sovepose", shelter_slug: "x-1" },
    });
  });

  it("fjerner parametre der kan identificere en person", () => {
    const r = internalEventRow("gear_suggestion_click", {
      guide_slug: "telt", email: "a@b.dk", client_id: "123", ip: "1.2.3.4", user_agent: "Mozilla",
    }, "/x");
    expect(r.params).toEqual({ guide_slug: "telt" });
  });

  it("afkorter lange værdier og dropper ikke-primitive", () => {
    const r = internalEventRow("gear_suggestion_click", { reason: "a".repeat(400), nested: { a: 1 } }, "/x");
    expect((r.params.reason as string).length).toBe(200);
    expect("nested" in r.params).toBe(false);
  });

  it("klipper stien så en lang URL ikke sprænger rækken", () => {
    const r = internalEventRow("gear_suggestion_click", {}, "/" + "y".repeat(500));
    expect(r.path!.length).toBe(300);
  });
});
