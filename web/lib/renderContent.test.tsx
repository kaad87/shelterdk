import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { AffiliateProduct } from "./affiliate-products";

// Mock the product data layer so tests don't hit the DB and don't require
// react.cache (which isn't available in jsdom).
vi.mock("./affiliate-products", () => ({
  getProduct: vi.fn(async () => null),
  getProducts: vi.fn(async (ids: string[]) => {
    const map = new Map<string, AffiliateProduct>();
    for (const id of ids) {
      map.set(id, {
        id,
        retailer: "outmore" as const,
        brand: "MockBrand",
        product_name: `Mock ${id}`,
        description: null,
        category_mapped: null,
        price: 100,
        price_original: 200,
        discount_pct: 50,
        in_stock: true,
        stock_count: null,
        image_url: "https://example.com/img.jpg",
        affiliate_url: "https://example.com",
        is_blocked: false,
      });
    }
    return map;
  }),
}));

import { renderContent, extractGearIds } from "./renderContent";

describe("extractGearIds", () => {
  it("extracts block directive ids", () => {
    const content = "Some text\n\n::gear[outmore-123]\n\nMore text";
    expect(extractGearIds(content)).toEqual(["outmore-123"]);
  });
  it("extracts group directive ids", () => {
    const content = "Text\n\n::gear-group[outmore-1, backpacker-2, outdoortid-3]";
    expect(extractGearIds(content).sort()).toEqual(
      ["backpacker-2", "outdoortid-3", "outmore-1"].sort()
    );
  });
  it("extracts inline directive ids", () => {
    const content = "I use ::gear-inline[outmore-123] for my trips.";
    expect(extractGearIds(content)).toEqual(["outmore-123"]);
  });
  it("deduplicates ids across directives", () => {
    const content = "::gear[outmore-123]\n\n::gear-inline[outmore-123]";
    expect(extractGearIds(content)).toEqual(["outmore-123"]);
  });
  it("returns empty for content with no directives", () => {
    expect(extractGearIds("Just text.")).toEqual([]);
  });
});

describe("renderContent with gear directives", () => {
  it("renders a ::gear[id] block as a GearCard", async () => {
    const content = "Intro\n\n::gear[outmore-999]\n\nOutro";
    const blocks = await renderContent(content);
    const { container } = render(<>{blocks}</>);
    expect(container.textContent).toMatch(/Mock outmore-999/);
  });
  it("renders ::gear-inline[id] inside a paragraph", async () => {
    const content = "I recommend ::gear-inline[outmore-999] for trips.";
    const blocks = await renderContent(content);
    const { container } = render(<>{blocks}</>);
    expect(container.textContent).toMatch(/I recommend/);
    expect(container.textContent).toMatch(/Mock outmore-999/);
    expect(container.textContent).toMatch(/for trips\./);
  });
  it("renders ::gear-group[a,b,c] as multiple cards in a grid", async () => {
    const content = "::gear-group[outmore-1, outmore-2, outmore-3]";
    const blocks = await renderContent(content);
    const { container } = render(<>{blocks}</>);
    expect(container.textContent).toMatch(/Mock outmore-1/);
    expect(container.textContent).toMatch(/Mock outmore-2/);
    expect(container.textContent).toMatch(/Mock outmore-3/);
  });
});

describe("renderContent backwards compatibility", () => {
  it("still renders H2 headings", async () => {
    const blocks = await renderContent("## Heading\n\nSome paragraph");
    const { container } = render(<>{blocks}</>);
    expect(container.querySelector("h2")).toHaveTextContent("Heading");
  });
  it("still renders bullet lists", async () => {
    const blocks = await renderContent("- item 1\n- item 2");
    const { container } = render(<>{blocks}</>);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
  });
  it("still renders bold and links inline", async () => {
    const blocks = await renderContent(
      "This is **bold** and [link](http://x)"
    );
    const { container } = render(<>{blocks}</>);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("a")).toHaveTextContent("link");
  });
});
