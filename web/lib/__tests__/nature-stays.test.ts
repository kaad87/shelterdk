import { describe, it, expect } from "vitest";
import { slugifyStayName, stayDisclosure, canPublishStay, toPointWkt } from "@/lib/nature-stays";

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
});
