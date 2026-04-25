import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../soeg/route";

vi.mock("@/lib/soeg-db", () => ({
  getSheltersPage: vi.fn(),
  SOEG_PAGE_SIZE: 24,
}));

vi.mock("@/lib/soeg-filters", () => ({
  filterSheltersByRegion: (shelters: { id: string; region?: string | null }[], region: string | null) => {
    if (!region?.trim()) return shelters;
    const r = region.trim();
    return shelters.filter((s) => (s.region || "").trim() === r);
  },
}));

import { getSheltersPage } from "@/lib/soeg-db";

const mockGetSheltersPage = vi.mocked(getSheltersPage);

function mockRequest(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /api/soeg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const req = mockRequest("http://localhost/api/soeg?billede=1&anmeldelser=1&bookbar=1");
    await GET(req);
    expect(mockGetSheltersPage).toHaveBeenCalledWith(null, null, 1, 24, {
      billede: true,
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
});
