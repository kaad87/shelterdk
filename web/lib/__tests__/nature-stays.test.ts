import { describe, it, expect } from "vitest";
import { slugifyStayName, stayDisclosure, canPublishStay, toPointWkt, getNearbyStays } from "@/lib/nature-stays";

describe("nature-stays helpers", () => {
  it("slugifyStayName laver rene URL-slugs (æøå → ae/oe/aa)", () => {
    expect(slugifyStayName("Skovly Glamping Æø")).toBe("skovly-glamping-aeoe");
    expect(slugifyStayName("Lærkereden Naturhytter")).toBe("laerkereden-naturhytter");
  });

  it("toPointWkt bygger korrekt WKT (lng lat)", () => {
    expect(toPointWkt(10.21, 56.15)).toBe("POINT(10.21 56.15)");
  });

  it("stayDisclosure varierer efter linkkilde", () => {
    expect(stayDisclosure("booking_com")).toMatch(/Booking\.com/);
    expect(stayDisclosure("direkte")).toMatch(/direkte/i);
    expect(stayDisclosure("andet_netvaerk")).toMatch(/kommission/i);
  });

  it("canPublishStay kræver både billede og dokumenteret tilladelse", () => {
    expect(canPublishStay({ image_url: "https://x/y.jpg", image_permission: "Ejer ok 2026-06-14" })).toBe(true);
    expect(canPublishStay({ image_url: "https://x/y.jpg", image_permission: null })).toBe(false);
    expect(canPublishStay({ image_url: null, image_permission: "Ejer ok" })).toBe(false);
    expect(canPublishStay({ image_url: "  ", image_permission: "  " })).toBe(false);
  });

  it("getNearbyStays kalder RPC med radius/limit og returnerer rækker", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const fake = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: [{ id: 1, slug: "x", distance_km: 4.2 }], error: null };
      },
    };
    const res = await getNearbyStays(56.15, 10.21, { radiusKm: 30, limit: 5 }, fake);
    expect(calls[0]).toEqual({
      fn: "get_nearby_stays",
      args: { p_lat: 56.15, p_lng: 10.21, p_radius_km: 30, p_limit: 5 },
    });
    expect(res).toHaveLength(1);
    expect(res[0].distance_km).toBe(4.2);
  });

  it("getNearbyStays bruger defaults (25 km, 3) og returnerer [] ved fejl", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const ok = { rpc: async (_fn: string, args: Record<string, unknown>) => { calls.push(args); return { data: null, error: null }; } };
    await getNearbyStays(1, 2, {}, ok);
    expect(calls[0]).toMatchObject({ p_radius_km: 25, p_limit: 3 });

    const errClient = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    expect(await getNearbyStays(1, 2, {}, errClient)).toEqual([]);
  });
});
