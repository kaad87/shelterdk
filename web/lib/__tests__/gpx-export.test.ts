import { describe, it, expect } from "vitest";
import { generateGpx, generateRouteGpx } from "@/lib/gpx-export";

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

describe("generateRouteGpx", () => {
  const lineGeometry: GeoJSON.LineString = {
    type: "LineString",
    coordinates: [
      [10.0, 56.0],
      [10.1, 56.1],
      [10.2, 56.2],
    ],
  };

  const multiLineGeometry: GeoJSON.MultiLineString = {
    type: "MultiLineString",
    coordinates: [
      [
        [10.0, 56.0],
        [10.1, 56.1],
      ],
      [
        [10.2, 56.2],
        [10.3, 56.3],
      ],
    ],
  };

  const shelters = [
    { name: "Shelter A", lat: 56.05, lon: 10.05 },
    { name: "Shelter B", lat: 56.15, lon: 10.15 },
  ];

  it("generates GPX with track from LineString geometry", () => {
    const gpx = generateRouteGpx("Testrute", lineGeometry, shelters);
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<name>Testrute</name>");
    expect(gpx).toContain('<trkpt lat="56" lon="10"');
    expect(gpx).toContain('<trkpt lat="56.1" lon="10.1"');
    expect(gpx).toContain('<trkpt lat="56.2" lon="10.2"');
    expect(gpx).toContain('<wpt lat="56.05" lon="10.05">');
    expect(gpx).toContain("<name>Shelter A</name>");
  });

  it("generates GPX with multiple track segments from MultiLineString", () => {
    const gpx = generateRouteGpx("Multi", multiLineGeometry, shelters);
    const segments = gpx.match(/<trkseg>/g);
    expect(segments).toHaveLength(2);
  });

  it("escapes XML in route name", () => {
    const gpx = generateRouteGpx('Rute "Test" & Co', lineGeometry, []);
    expect(gpx).toContain("&amp;");
    expect(gpx).toContain("&quot;");
  });

  it("works with empty shelter list", () => {
    const gpx = generateRouteGpx("Solo", lineGeometry, []);
    expect(gpx).toContain("<trk>");
    expect(gpx).not.toContain("<wpt");
  });
});
