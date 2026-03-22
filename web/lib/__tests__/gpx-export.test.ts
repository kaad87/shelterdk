import { describe, it, expect } from "vitest";
import { generateGpx } from "@/lib/gpx-export";

describe("generateGpx", () => {
  it("returns empty string for no waypoints", () => {
    expect(generateGpx([])).toBe("");
  });

  it("generates valid GPX with wpt and trk elements", () => {
    const waypoints = [
      { name: "Shelter A", lat: 56.178, lon: 10.055 },
      { name: "Shelter B", lat: 56.312, lon: 10.201 },
    ];
    const gpx = generateGpx(waypoints);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain("ShelterDK Ruteplanner");
    expect(gpx).toContain('<wpt lat="56.178" lon="10.055">');
    expect(gpx).toContain("<name>Shelter A</name>");
    expect(gpx).toContain('<wpt lat="56.312" lon="10.201">');
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain("<trkseg>");
    expect(gpx).toContain('<trkpt lat="56.178" lon="10.055"');
    expect(gpx).toContain('<trkpt lat="56.312" lon="10.201"');
  });

  it("escapes XML special characters in names", () => {
    const waypoints = [
      { name: 'Shelter "Uglen" & Co', lat: 56.0, lon: 10.0 },
    ];
    const gpx = generateGpx(waypoints);
    expect(gpx).toContain("&amp;");
    expect(gpx).toContain("&quot;");
    expect(gpx).not.toContain('& Co');
  });

  it("generates single waypoint without trk", () => {
    const waypoints = [{ name: "Solo", lat: 56.0, lon: 10.0 }];
    const gpx = generateGpx(waypoints);
    expect(gpx).toContain("<wpt");
    expect(gpx).not.toContain("<trk>");
  });
});
