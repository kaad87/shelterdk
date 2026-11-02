import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// GearCardView traekker datalaget ind; det maa ikke starte Supabase i jsdom.
vi.mock("@/lib/affiliate-products", () => ({
  getProduct: vi.fn(async () => null),
  getProducts: vi.fn(async () => new Map()),
}));

import { BuyingGuideEntry } from "@/components/buying-guide/BuyingGuideEntry";
import type { GuideEntryWithProduct } from "@/lib/buying-guides";

const entry: GuideEntryWithProduct = {
  id: "e1",
  rank: 1,
  award_label: "Vores valg",
  editorial_note: "Den vi selv ville tage med.",
  pros: ["Let"],
  cons: ["Dyr"],
  score: 8.7,
  best_for: "korte sommerture",
  product: {
    id: "outdoortid-44032400916791",
    retailer: "outdoortid",
    brand: "Nordic Peak",
    product_name: "Telt - Nordic Peak Thera 2.0",
    display_name: null,
    display_brand: null,
    ean: null,
    description: "2-personers telt",
    category_mapped: "telt",
    price: 299,
    price_original: 549,
    discount_pct: 46,
    in_stock: true,
    stock_count: null,
    image_url: "https://example.com/image.jpg",
    affiliate_url: "https://example.com/buy",
    is_blocked: false,
    shipping_cost: 0,
  },
};

describe("BuyingGuideEntry – link til produktsiden", () => {
  it("linker til /grej/<slug> naar varen har en side", () => {
    render(<BuyingGuideEntry entry={entry} position={1} produktSlug="nordic-peak-thera-2p0" />);
    const link = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("href")?.startsWith("/grej/"));
    expect(link).toBeDefined();
    expect(link).toHaveAttribute("href", "/grej/nordic-peak-thera-2p0");
  });

  it("bruger det rensede navn som ankertekst, ikke feedets", () => {
    // Ankerteksten er det Google laeser som emnet for maalsiden. Feedets
    // "Telt - Nordic Peak Thera 2.0" ville goere "Telt" til det foerste ord.
    render(<BuyingGuideEntry entry={entry} position={1} produktSlug="nordic-peak-thera-2p0" />);
    const link = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("href")?.startsWith("/grej/"));
    expect(link?.textContent).toContain("Nordic Peak Thera 2.0");
    expect(link?.textContent).not.toContain("Telt -");
  });

  it("viser intet link naar varen ingen produktside har", () => {
    // Kollisionstaberne i produktIndeks faar ingen slug. Et udregnet link
    // ville pege paa en side om en anden vare.
    render(<BuyingGuideEntry entry={entry} position={1} />);
    const grej = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href")?.startsWith("/grej/"));
    expect(grej).toHaveLength(0);
  });
});
