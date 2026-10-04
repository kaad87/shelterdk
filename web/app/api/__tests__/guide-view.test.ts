import { describe, it, expect } from "vitest";
import { INTERNAL_EVENTS, internalEventRow } from "@/lib/internal-events";

describe("guide_view", () => {
  it("logges til internal_events — GA4 mangler to tredjedele af guide-besøgene", () => {
    expect(INTERNAL_EVENTS.has("guide_view")).toBe(true);
  });

  it("bærer guidens slug og hvor besøget kom fra", () => {
    const r = internalEventRow("guide_view", { guide_slug: "sovepose", fra: "shelter" }, "/bedste/sovepose?fra=shelter");
    expect(r.params).toEqual({ guide_slug: "sovepose", fra: "shelter" });
    expect(r.path).toBe("/bedste/sovepose?fra=shelter");
  });
});
