import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../soeg/route";

vi.mock("@/lib/soeg-db", () => ({
  getSheltersPage: vi.fn(),
  SOEG_PAGE_SIZE: 24,
}));

vi.mock("@/lib/postnummer", () => ({
  fetchPostnummerBbox: vi.fn(),
  lookupPostnummer: vi.fn(),
}));

vi.mock("@/lib/soeg-filters", () => ({
  normalizeRegionFilter: (region: string | null) => {
    if (!region) return null;
    if (region === "Sjælland") return "Sjælland og Øerne";
    return region;
  },
  filterSheltersByRegion: (shelters: { id: string; region?: string | null }[], region: string | null) => {
    if (!region?.trim()) return shelters;
    const r = region === "Sjælland" ? "Sjælland og Øerne" : region.trim();
    return shelters.filter((s) => (s.region || "").trim() === r);
  },
}));

import { getSheltersPage } from "@/lib/soeg-db";
import { fetchPostnummerBbox, lookupPostnummer } from "@/lib/postnummer";

const mockGetSheltersPage = vi.mocked(getSheltersPage);
const mockFetchPostnummerBbox = vi.mocked(fetchPostnummerBbox);
const mockLookupPostnummer = vi.mocked(lookupPostnummer);

function mockRequest(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /api/soeg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPostnummerBbox.mockResolvedValue(null);
    mockLookupPostnummer.mockReturnValue(null);
    mockGetSheltersPage.mockResolvedValue({
      shelters: [
        { id: "1", title: "A", slug: "a", region: "Jylland" } as never,
        { id: "2", title: "B", slug: "b", region: "Sjælland" } as never,
      ],
      hasMore: false,
    });
  });

  it("returnerer shelters og hasMore", async () => {
    const req = mockRequest("http://localhost/api/soeg");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shelters).toBeDefined();
    expect(data.hasMore).toBe(false);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(null, null, 1, 24, undefined, undefined, null, undefined);
  });

  it("sender region til getSheltersPage", async () => {
    const req = mockRequest("http://localhost/api/soeg?region=Jylland");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(
      "Jylland",
      null,
      1,
      24,
      undefined,
      undefined,
      null,
      undefined
    );
  });

  it("normaliserer Sjælland til DB-regionen", async () => {
    const req = mockRequest("http://localhost/api/soeg?region=Sj%C3%A6lland");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(
      "Sjælland og Øerne",
      null,
      1,
      24,
      undefined,
      undefined,
      null,
      undefined
    );
  });

  it("filtrerer shelters efter region", async () => {
    const req = mockRequest("http://localhost/api/soeg?region=Jylland");
    const res = await GET(req);
    const data = await res.json();
    expect(data.shelters).toHaveLength(1);
    expect(data.shelters[0].region).toBe("Jylland");
  });

  it("sender page til getSheltersPage", async () => {
    const req = mockRequest("http://localhost/api/soeg?page=3");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(null, null, 3, 24, undefined, undefined, null, undefined);
  });

  it("sender søgetekst til getSheltersPage", async () => {
    const req = mockRequest("http://localhost/api/soeg?q=Brønderslev");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(null, "Brønderslev", 1, 24, undefined, undefined, null, undefined);
  });

  it("sender filtre til getSheltersPage", async () => {
    const req = mockRequest("http://localhost/api/soeg?anmeldelser=1&bookbar=1");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(null, null, 1, 24, {
      anmeldelser: true,
      bookbar: true,
    }, undefined, null, undefined);
  });

  it("sender bbox til getSheltersPage ved minLat/maxLat/minLon/maxLon", async () => {
    const req = mockRequest(
      "http://localhost/api/soeg?minLat=55&maxLat=57&minLon=8&maxLon=11"
    );
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(
      null,
      null,
      1,
      24,
      undefined,
      { minLat: 55, maxLat: 57, minLon: 8, maxLon: 11 },
      null,
      undefined
    );
  });

  it("falder tilbage til bynavn ved postnummer når bbox-opslag fejler", async () => {
    mockLookupPostnummer.mockReturnValue("Billund");
    const req = mockRequest("http://localhost/api/soeg?q=7190");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(
      null,
      "Billund",
      1,
      24,
      undefined,
      undefined,
      null,
      undefined
    );
  });
});
