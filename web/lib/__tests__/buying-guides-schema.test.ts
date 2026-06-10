import { describe, it, expect } from "vitest";
import { buildItemListSchema, buildProductSchema } from "@/lib/buying-guides-schema";

const product = {
  product_name: "Test Sovepose",
  brand: "Acme",
  image_url: "https://x/i.jpg",
  price: 999,
  affiliate_url: "https://shop/x",
  retailer: "backpackerlife",
  in_stock: true,
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
    const s = buildProductSchema({ ...product }, { score: 8.7 });
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

describe("buildProductSchema – lager, pros/cons, reviewBody, priceValidUntil", () => {
  it("sætter OutOfStock når produktet er udsolgt", () => {
    const s = buildProductSchema({ ...product, in_stock: false });
    expect((s.offers as { availability: string }).availability).toBe(
      "https://schema.org/OutOfStock"
    );
  });

  it("sætter InStock når produktet er på lager", () => {
    const s = buildProductSchema({ ...product, in_stock: true });
    expect((s.offers as { availability: string }).availability).toBe(
      "https://schema.org/InStock"
    );
  });

  it("lægger pros/cons i review som positiveNotes/negativeNotes (ItemList)", () => {
    const s = buildProductSchema(
      { ...product, in_stock: true },
      { score: 8.5, pros: ["Varm", "Let"], cons: ["Stor pakstørrelse"] }
    );
    const review = s.review as Record<string, unknown>;
    const pos = review.positiveNotes as { itemListElement: { name: string; position: number }[] };
    const neg = review.negativeNotes as { itemListElement: { name: string }[] };
    expect(pos.itemListElement.map((x) => x.name)).toEqual(["Varm", "Let"]);
    expect(pos.itemListElement[0].position).toBe(1);
    expect(neg.itemListElement[0].name).toBe("Stor pakstørrelse");
  });

  it("udelader positiveNotes/negativeNotes uden pros/cons", () => {
    const s = buildProductSchema({ ...product, in_stock: true }, { score: 8.5 });
    const review = s.review as Record<string, unknown>;
    expect(review.positiveNotes).toBeUndefined();
    expect(review.negativeNotes).toBeUndefined();
  });

  it("bruger editorial note som reviewBody", () => {
    const s = buildProductSchema(
      { ...product, in_stock: true },
      { score: 9, reviewBody: "Vores favorit til vinterbrug." }
    );
    expect((s.review as { reviewBody: string }).reviewBody).toBe(
      "Vores favorit til vinterbrug."
    );
  });

  it("sætter rullende priceValidUntil (~30 dage frem)", () => {
    const s = buildProductSchema({ ...product, in_stock: true });
    const until = (s.offers as { priceValidUntil: string }).priceValidUntil;
    expect(until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days = (new Date(until).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(25);
    expect(days).toBeLessThan(35);
  });

  it("infererer brand fra produktnavn når brand mangler", () => {
    const s = buildProductSchema({
      ...product,
      brand: null,
      product_name: "Sovepose - Treklife Peak 4S - 4 sæsons",
      in_stock: true,
    });
    expect((s.brand as { name: string }).name).toBe("Treklife");
  });

  it("udelader brand når intet kendt brand findes i navnet", () => {
    const s = buildProductSchema({
      ...product,
      brand: null,
      product_name: "Sovepose - Sleepline 250 - 2 sæsons",
      in_stock: true,
    });
    expect(s.brand).toBeUndefined();
  });
});
