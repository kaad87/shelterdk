import { describe, it, expect } from "vitest";
import { diversify, prioritizeBackpackerlife } from "./affiliate-deals";
import type { AffiliateProduct } from "./affiliate-products";

function mockP(
  id: string,
  category: string | null,
  discount = 50,
  retailer: AffiliateProduct["retailer"] = "outmore"
): AffiliateProduct {
  return {
    id,
    retailer,
    brand: null,
    product_name: id,
    description: null,
    category_mapped: category,
    price: 100,
    price_original: 200,
    discount_pct: discount,
    in_stock: true,
    stock_count: null,
    image_url: "x",
    affiliate_url: "y",
    is_blocked: false,
  };
}

describe("diversify", () => {
  it("caps products per category", () => {
    const products = [
      mockP("1", "telt"),
      mockP("2", "telt"),
      mockP("3", "telt"),
      mockP("4", "telt"),
      mockP("5", "telt"),
      mockP("6", "sovepose"),
    ];
    const result = diversify(products, { maxPerCategory: 2, targetSize: 40 });
    expect(result.filter((p) => p.category_mapped === "telt")).toHaveLength(2);
    expect(result.filter((p) => p.category_mapped === "sovepose")).toHaveLength(1);
  });
  it("preserves input order when under caps", () => {
    const products = [mockP("1", "a"), mockP("2", "b"), mockP("3", "a")];
    const result = diversify(products, { maxPerCategory: 5, targetSize: 40 });
    expect(result.map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
  it("stops at targetSize", () => {
    const products = Array.from({ length: 100 }, (_, i) =>
      mockP(`${i}`, `cat-${i % 10}`)
    );
    const result = diversify(products, { maxPerCategory: 4, targetSize: 5 });
    expect(result).toHaveLength(5);
  });
  it("treats null categories as 'other' bucket", () => {
    const products = [mockP("1", null), mockP("2", null), mockP("3", null)];
    const result = diversify(products, { maxPerCategory: 2, targetSize: 40 });
    expect(result).toHaveLength(2);
  });
});

describe("prioritizeBackpackerlife", () => {
  it("moves backpackerlife products ahead of other retailers within the same discount tier", () => {
    const products = [
      mockP("a", "telt", 50, "outmore"),
      mockP("b", "telt", 50, "backpackerlife"),
      mockP("c", "telt", 50, "outdoortid"),
      mockP("d", "telt", 50, "backpackerlife"),
    ];
    const result = prioritizeBackpackerlife(products);
    expect(result.map((p) => p.retailer)).toEqual([
      "backpackerlife",
      "backpackerlife",
      "outmore",
      "outdoortid",
    ]);
  });

  it("preserves discount ordering across tiers (higher discount still wins)", () => {
    const products = [
      mockP("a", "telt", 70, "outmore"),
      mockP("b", "telt", 50, "backpackerlife"),
      mockP("c", "telt", 60, "outdoortid"),
    ];
    const result = prioritizeBackpackerlife(products);
    expect(result.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("is stable within a discount tier for non-backpackerlife retailers", () => {
    const products = [
      mockP("a", "telt", 50, "outmore"),
      mockP("b", "telt", 50, "outdoortid"),
      mockP("c", "telt", 50, "outmore"),
    ];
    const result = prioritizeBackpackerlife(products);
    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});
