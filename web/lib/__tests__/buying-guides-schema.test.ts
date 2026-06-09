import { describe, it, expect } from "vitest";
import { buildItemListSchema, buildProductSchema } from "@/lib/buying-guides-schema";

const product = {
  product_name: "Test Sovepose",
  brand: "Acme",
  image_url: "https://x/i.jpg",
  price: 999,
  affiliate_url: "https://shop/x",
  retailer: "backpackerlife",
} as Parameters<typeof buildProductSchema>[0];

describe("buildItemListSchema", () => {
  it("laver ItemList med position pr. produkt", () => {
    const s = buildItemListSchema(
      [{ product }, { product }],
      "https://shelterdk.dk/bedste/sovepose"
    );
    expect(s["@type"]).toBe("ItemList");
    expect((s.itemListElement as unknown[]).length).toBe(2);
    expect((s.itemListElement as { position: number }[])[0].position).toBe(1);
    expect((s.itemListElement as { position: number }[])[1].position).toBe(2);
  });

  it("sender score videre til Product-review", () => {
    const s = buildItemListSchema([{ product, score: 8.7 }], "https://x");
    const item = (s.itemListElement as { item: Record<string, unknown> }[])[0].item;
    expect(item.review).toBeDefined();
  });
});

describe("buildProductSchema", () => {
  it("inkluderer navn, brand og offers med pris i DKK", () => {
    const s = buildProductSchema(product);
    expect(s["@type"]).toBe("Product");
    expect(s.name).toBe("Test Sovepose");
    expect((s.offers as { price: number }).price).toBe(999);
    expect((s.offers as { priceCurrency: string }).priceCurrency).toBe("DKK");
  });

  it("udelader brand når null", () => {
    const s = buildProductSchema({ ...product, brand: null });
    expect(s.brand).toBeUndefined();
  });

  it("tilføjer review når score er sat", () => {
    const s = buildProductSchema({ ...product }, 8.7);
    const r = s.review as {
      reviewRating: { ratingValue: number; bestRating: number };
      author: { name: string };
    };
    expect(r.reviewRating.ratingValue).toBe(8.7);
    expect(r.reviewRating.bestRating).toBe(10);
    expect(r.author.name).toMatch(/ShelterDK/);
  });

  it("uden score → intet review-felt", () => {
    expect(buildProductSchema({ ...product }).review).toBeUndefined();
  });
});
