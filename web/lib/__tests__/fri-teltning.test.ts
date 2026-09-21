import { describe, it, expect } from "vitest";
import { groupByRegion, formatHa, summarize, type FriTeltningArea } from "@/lib/fri-teltning";

const a = (o: Partial<FriTeltningArea>): FriTeltningArea =>
  ({ id: "x", slug: "x", name: "X", kommune: "K", kommunekode: 1, region: "Jylland", org: null, contact: null, link: null, ha: 10, lat: 56, lng: 9, water: false, description: null, ...o });

describe("groupByRegion", () => {
  it("grupperer i DB's regionsrækkefølge og sorterer områder dansk-alfabetisk", () => {
    const g = groupByRegion([a({ name: "Ålborg Skov", region: "Jylland" }), a({ name: "Almindingen", region: "Sjælland og Øerne" }), a({ name: "Bording", region: "Jylland" })]);
    expect(g.map((x) => x.region)).toEqual(["Jylland", "Sjælland og Øerne"]);
    expect(g[0].areas.map((x) => x.name)).toEqual(["Bording", "Ålborg Skov"]);
  });
  it("udelader tomme regioner", () => {
    expect(groupByRegion([a({ region: "Fyn" })]).map((x) => x.region)).toEqual(["Fyn"]);
  });
});

describe("formatHa", () => {
  it("runder til hele hektar med dansk tusindtalsseparator", () => {
    expect(formatHa(3227.8)).toBe("3.228 ha");
    expect(formatHa(0.4)).toBe("under 1 ha");
    expect(formatHa(null)).toBe("");
  });
});

describe("summarize", () => {
  it("giver antal, samlet areal og antal kommuner", () => {
    const s = summarize([a({ ha: 100, kommune: "A" }), a({ ha: 50.4, kommune: "B" }), a({ ha: null, kommune: "A" })]);
    expect(s).toEqual({ count: 3, totalHa: 150, kommuner: 2 });
  });
});
