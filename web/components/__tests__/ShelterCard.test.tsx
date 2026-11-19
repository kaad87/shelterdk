import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShelterCard } from "../ShelterCard";
import type { Shelter } from "@/types/shelter";

/**
 * Kort uden eksplicit href (forsidens "Udforsk shelters", /soeg) brugte før
 * /shelter/[slug], som svarer 308 til silo-URL'en. Interne links gennem en
 * redirect spilder crawl-budget, så kortet skal selv bygge den kanoniske sti.
 */
function shelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "x",
    title: "Logismose",
    slug: "logismose-10073",
    description: null,
    region: "Fyn",
    kommune: "Assens",
    ...overrides,
  } as Shelter;
}

const linkTil = () => screen.getAllByRole("link")[0].getAttribute("href");

describe("ShelterCard-link", () => {
  it("linker kanonisk når region og kommune kendes", () => {
    render(<ShelterCard shelter={shelter()} />);
    expect(linkTil()).toBe("/danmark/fyn/assens/logismose-10073");
  });

  it("beholder /shelter/ for shelters uden reel region", () => {
    render(<ShelterCard shelter={shelter({ region: "Danmark", kommune: null })} />);
    expect(linkTil()).toBe("/shelter/logismose-10073");
  });

  it("lader en eksplicit href vinde", () => {
    render(<ShelterCard shelter={shelter()} href="/noget-andet" />);
    expect(linkTil()).toBe("/noget-andet");
  });
});
