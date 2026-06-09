import { describe, it, expect } from "vitest";
import { groupGuides, relatedGuides, type HubGuide } from "@/lib/buying-guides-hub";

const g = (slug: string, category: string, parent_slug: string | null = null): HubGuide => ({
  slug,
  title: slug,
  category,
  intro: null,
  parent_slug,
});

describe("groupGuides", () => {
  it("grupperer guider efter hub-gruppe i defineret rækkefølge", () => {
    const out = groupGuides([g("kniv", "kniv"), g("sovepose", "sovepose"), g("telt", "telt")]);
    const labels = out.map((s) => s.group);
    expect(labels.indexOf("Sovegrej")).toBeLessThan(labels.indexOf("Telte & ly"));
    expect(out.find((s) => s.group === "Sovegrej")!.guides.map((x) => x.slug)).toContain("sovepose");
    expect(out.find((s) => s.group === "Værktøj & udstyr")!.guides.map((x) => x.slug)).toContain("kniv");
  });
  it("udelader tomme grupper", () => {
    const out = groupGuides([g("sovepose", "sovepose")]);
    expect(out.every((s) => s.guides.length > 0)).toBe(true);
  });
  it("ukendt kategori havner i 'Andet' (falder ikke ud)", () => {
    const out = groupGuides([g("x", "ukendt-kat")]);
    expect(out.flatMap((s) => s.guides).map((x) => x.slug)).toContain("x");
  });
});

describe("relatedGuides", () => {
  const all = [
    g("sovepose", "sovepose"),
    g("sovepose-til-vinter", "sovepose", "sovepose"),
    g("liggeunderlag", "liggeunderlag"),
    g("kniv", "kniv"),
  ];
  it("variant viser parent + søskende i samme gruppe, ekskl. sig selv og andre grupper", () => {
    const r = relatedGuides("sovepose-til-vinter", all).map((x) => x.slug);
    expect(r).toContain("sovepose");
    expect(r).toContain("liggeunderlag");
    expect(r).not.toContain("sovepose-til-vinter");
    expect(r).not.toContain("kniv");
  });
  it("hovedguide viser egne varianter + søskende", () => {
    const r = relatedGuides("sovepose", all).map((x) => x.slug);
    expect(r).toContain("sovepose-til-vinter");
    expect(r).toContain("liggeunderlag");
  });
  it("cap'er antal", () => {
    expect(relatedGuides("sovepose", all, 1).length).toBeLessThanOrEqual(1);
  });
});
