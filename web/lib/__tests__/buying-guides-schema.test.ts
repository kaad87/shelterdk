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
    const s = buildItemListSchema([product, product], "https://shelterdk.dk/bedste/sovepose");
    expect(s["@type"]).toBe("ItemList");
    expect((s.itemListElement as unknown[]).length).toBe(2);
    expect((s.itemListElement as { position: number }[])[0].position).toBe(1);
    expect((s.itemListElement as { position: number }[])[1].position).toBe(2);
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
});
