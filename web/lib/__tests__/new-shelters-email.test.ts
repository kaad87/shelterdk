import { describe, it, expect } from "vitest";
import { buildNewSheltersDigest } from "@/lib/new-shelters-email";
import type { Shelter } from "@/types/shelter";

function shelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "1",
    title: "Skovens Shelter",
    slug: "skovens-shelter-123",
    description: "Et hyggeligt shelter i skoven med plads til hele familien.",
    image_url: "https://example.com/skov.jpg",
    region: "Jylland",
    kommune: "Aarhus",
    ...overrides,
  } as Shelter;
}

const origin = "https://shelterdk.dk";
const unsubscribeUrl = `${origin}/api/newsletter/unsubscribe?email=a%40b.dk`;

describe("buildNewSheltersDigest", () => {
  it("returnerer null ved ingen shelters", () => {
    expect(buildNewSheltersDigest([], { unsubscribeUrl, origin })).toBeNull();
  });

  it("subject angiver antal i flertal", () => {
    const d = buildNewSheltersDigest([shelter(), shelter({ id: "2", slug: "to-456" })], { unsubscribeUrl, origin });
    expect(d?.subject).toMatch(/2 nye shelters/);
  });

  it("subject i ental ved ét shelter", () => {
    const d = buildNewSheltersDigest([shelter()], { unsubscribeUrl, origin });
    expect(d?.subject).toMatch(/[Ee]t nyt shelter/);
  });

  it("html indeholder titel, absolut link, afmelding og 'se alle'", () => {
    const d = buildNewSheltersDigest([shelter()], { unsubscribeUrl, origin })!;
    expect(d.html).toContain("Skovens Shelter");
    expect(d.html).toContain(`${origin}/danmark/jylland/aarhus/skovens-shelter-123`);
    expect(d.html).toContain(unsubscribeUrl);
    expect(d.html).toContain(`${origin}/nye`);
  });

  it("text-varianten har titel og afmeldings-URL", () => {
    const d = buildNewSheltersDigest([shelter()], { unsubscribeUrl, origin })!;
    expect(d.text).toContain("Skovens Shelter");
    expect(d.text).toContain(unsubscribeUrl);
  });
});
