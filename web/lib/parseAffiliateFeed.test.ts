import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseStockField,
  calculateDiscountPct,
  normalizeProduct,
  parseFeedXml,
} from "./parseAffiliateFeed";

describe("parseStockField", () => {
  it("parses string 'in stock' as in stock with unknown count", () => {
    expect(parseStockField("in stock")).toEqual({ in_stock: true, stock_count: null });
  });
  it("parses 'in_stock' (Outdoortid format)", () => {
    expect(parseStockField("in_stock")).toEqual({ in_stock: true, stock_count: null });
  });
  it("parses 'på lager' (Danish)", () => {
    expect(parseStockField("på lager")).toEqual({ in_stock: true, stock_count: null });
  });
  it("parses numeric value as stock_count", () => {
    expect(parseStockField("5")).toEqual({ in_stock: true, stock_count: 5 });
    expect(parseStockField("1")).toEqual({ in_stock: true, stock_count: 1 });
  });
  it("parses zero as out of stock", () => {
    expect(parseStockField("0")).toEqual({ in_stock: false, stock_count: 0 });
  });
  it("parses 'udsolgt' as out of stock", () => {
    expect(parseStockField("udsolgt")).toEqual({ in_stock: false, stock_count: 0 });
  });
  it("treats null/empty as out of stock", () => {
    expect(parseStockField(null)).toEqual({ in_stock: false, stock_count: null });
    expect(parseStockField("")).toEqual({ in_stock: false, stock_count: null });
  });
  it("treats unknown format as out of stock to fail safe", () => {
    expect(parseStockField("coming soon")).toEqual({ in_stock: false, stock_count: null });
  });
});

describe("calculateDiscountPct", () => {
  it("returns null when no original price", () => {
    expect(calculateDiscountPct(299, null)).toBeNull();
    expect(calculateDiscountPct(299, undefined as unknown as number)).toBeNull();
  });
  it("returns null when original price equals current price", () => {
    expect(calculateDiscountPct(299, 299)).toBeNull();
  });
  it("returns null when current price is higher (not a discount)", () => {
    expect(calculateDiscountPct(399, 299)).toBeNull();
  });
  it("rounds to nearest integer", () => {
    expect(calculateDiscountPct(299, 549)).toBe(46); // (549-299)/549 = 0.4553 → 46
    expect(calculateDiscountPct(221.95, 241.03)).toBe(8); // 0.0792 → 8
  });
  it("handles 100% discount edge case", () => {
    expect(calculateDiscountPct(0, 100)).toBe(100);
  });
});

describe("normalizeProduct", () => {
  it("builds the id as '{retailer}-{retailer_product_id}'", () => {
    const raw = {
      forhandler: "Outmore.dk",
      produktid: "3342540815643",
      produktnavn: "Test",
      nypris: "100.00",
      glpris: "100.00",
      billedurl: "https://example.com/img.jpg",
      vareurl: "https://example.com",
      lagerantal: "5",
    };
    const n = normalizeProduct(raw, "outmore");
    expect(n?.id).toBe("outmore-3342540815643");
  });
  it("returns null for missing required fields", () => {
    expect(normalizeProduct({}, "outmore")).toBeNull();
    expect(
      normalizeProduct(
        {
          produktid: "1",
          produktnavn: "Test",
          billedurl: "x",
          vareurl: "y",
        },
        "outmore"
      )
    ).toBeNull(); // missing nypris
  });
  it("calculates discount correctly from glpris/nypris", () => {
    const n = normalizeProduct(
      {
        forhandler: "Outdoortid.dk",
        produktid: "1",
        produktnavn: "Tent",
        nypris: "299.00",
        glpris: "549.00",
        billedurl: "https://example.com/img.jpg",
        vareurl: "https://example.com",
        lagerantal: "in_stock",
        beskrivelse: "Nice tent",
      },
      "outdoortid"
    );
    expect(n?.discount_pct).toBe(46);
    expect(n?.price).toBe(299);
    expect(n?.price_original).toBe(549);
  });
  it("passes through brand and ean when present (Outmore)", () => {
    const n = normalizeProduct(
      {
        forhandler: "Outmore.dk",
        produktid: "1",
        produktnavn: "Headlamp",
        nypris: "221.95",
        glpris: "241.03",
        brand: "PETZL",
        ean: "3342540815643",
        billedurl: "x",
        vareurl: "y",
        lagerantal: "1",
      },
      "outmore"
    );
    expect(n?.brand).toBe("PETZL");
    expect(n?.ean).toBe("3342540815643");
    expect(n?.stock_count).toBe(1);
  });
  it("decodes hierarchical categories from Backpackerlife", () => {
    const n = normalizeProduct(
      {
        forhandler: "Backpackerlife.dk",
        produktid: "1",
        produktnavn: "Mug",
        nypris: "339.00",
        glpris: "339.00",
        kategorinavn: "Gaveideer > Kokken > Termoflasker",
        billedurl: "x",
        vareurl: "y",
        lagerantal: "in stock",
      },
      "backpackerlife"
    );
    expect(n?.category_raw).toBe("Gaveideer > Kokken > Termoflasker");
  });
});

describe("parseFeedXml", () => {
  it("parses the Outmore sample fixture and produces products", () => {
    const xml = fs.readFileSync(path.join(__dirname, "../test/fixtures/outmore-sample.xml"));
    const products = parseFeedXml(xml, "outmore");
    expect(products.length).toBeGreaterThanOrEqual(2);
    const first = products[0];
    expect(first.retailer).toBe("outmore");
    expect(first.id).toMatch(/^outmore-/);
    expect(first.price).toBeGreaterThan(0);
  });
  it("parses the Backpackerlife sample (handles iso-8859-1 æøå)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "../test/fixtures/backpackerlife-sample.xml"));
    const products = parseFeedXml(xml, "backpackerlife");
    expect(products.length).toBeGreaterThanOrEqual(2);
    // At least one product should contain a non-ASCII Danish character
    // (ø, æ, å) in its name or description — confirms iso-8859-1 decoding worked
    const hasDanish = products.some((p) =>
      /[æøåÆØÅ]/.test((p.product_name ?? "") + (p.description ?? ""))
    );
    expect(hasDanish).toBe(true);
  });
  it("parses the Outdoortid sample", () => {
    const xml = fs.readFileSync(path.join(__dirname, "../test/fixtures/outdoortid-sample.xml"));
    const products = parseFeedXml(xml, "outdoortid");
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products[0].retailer).toBe("outdoortid");
  });
  it("returns empty array on malformed XML", () => {
    const xml = Buffer.from("<?xml version='1.0'?><not-valid>oops");
    const products = parseFeedXml(xml, "outmore");
    expect(products).toEqual([]);
  });
});
