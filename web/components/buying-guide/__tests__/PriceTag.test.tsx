import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceTag } from "../PriceTag";

describe("PriceTag", () => {
  it("daterer prisfaldet", () => {
    render(<PriceTag price={495} priceOriginal={739} discountPct={33} faldetSiden="2026-11-14" />);
    expect(screen.getByText("faldet 14. nov.")).toBeInTheDocument();
    expect(screen.getByText("−33%")).toBeInTheDocument();
  });

  it("viser hverken rabat eller dato, naar der ikke er et prisfald", () => {
    // Det getGuideBySlug giver en vare, vi ikke har set falde: begge felter null.
    const { container } = render(<PriceTag price={495} priceOriginal={null} discountPct={null} />);
    expect(container.textContent).toBe("495 kr.");
  });

  it("skriver ingen dato uden en foer-pris at haenge den paa", () => {
    render(<PriceTag price={495} priceOriginal={null} discountPct={null} faldetSiden="2026-11-14" />);
    expect(screen.queryByText(/faldet/)).toBeNull();
  });
});
