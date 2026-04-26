import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { SoegContent } from "../SoegContent";
import type { Shelter } from "@/types/shelter";

vi.mock("../ShelterMap", () => ({
  ShelterMap: () => <div data-testid="shelter-map">Kort</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function mk(id: string, region: string): Shelter {
  return {
    id,
    title: `Shelter ${id}`,
    slug: `shelter-${id}`,
    description: null,
    location: null,
    image_url: null,
    google_rating: null,
    google_user_ratings_total: null,
    booking_url: null,
    duplicate_of_shelter_id: null,
    region,
  } as Shelter;
}

describe("SoegContent", () => {
  it("viser antal shelters med region når initialRegion er Jylland", () => {
    const shelters = [mk("1", "Jylland"), mk("2", "Jylland")];
    render(
      <SoegContent
        initialShelters={shelters}
        initialHasMore={false}
        initialRegion="Jylland"
        initialQuery={null}
        view="split"
      />
    );
    expect(screen.getByText(/2 shelters i Jylland/)).toBeInTheDocument();
  });

  it("viser kun shelters fra valgt region", () => {
    const shelters = [
      mk("1", "Jylland"),
      mk("2", "Sjælland"),
    ];
    render(
      <SoegContent
        initialShelters={shelters}
        initialHasMore={false}
        initialRegion="Jylland"
        initialQuery={null}
        view="split"
      />
    );
    // Filtrering: kun Jylland
    expect(screen.getByText(/1 shelter i Jylland/)).toBeInTheDocument();
    expect(screen.getByText("Shelter 1")).toBeInTheDocument();
    expect(screen.queryByText("Shelter 2")).not.toBeInTheDocument();
  });

  it("viser 'i Danmark' når ingen region", () => {
    const shelters = [mk("1", "Jylland")];
    render(
      <SoegContent
        initialShelters={shelters}
        initialHasMore={false}
        initialRegion={null}
        initialQuery={null}
        view="split"
      />
    );
    expect(screen.getByText(/1 shelter i Danmark/)).toBeInTheDocument();
  });

  it("viser tom besked når ingen shelters", () => {
    render(
      <SoegContent
        initialShelters={[]}
        initialHasMore={false}
        initialRegion={null}
        initialQuery={null}
        view="split"
      />
    );
    expect(screen.getByText(/ingen shelters matcher din søgning/i)).toBeInTheDocument();
  });
});
