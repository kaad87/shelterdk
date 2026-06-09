import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub out the server-only data layer module so the GearCard module graph
// doesn't try to initialise Supabase or call react.cache in jsdom.
vi.mock("@/lib/affiliate-products", () => ({
  getProduct: vi.fn(async () => null),
  getProducts: vi.fn(async () => new Map()),
}));

import { GearCardView } from "./GearCard";
import type { AffiliateProduct } from "@/lib/affiliate-products";

const mockProduct: AffiliateProduct = {
  id: "outdoortid-44032400916791",
  retailer: "outdoortid",
  brand: "Nordic Peak",
  product_name: "Nordic Peak Thera 2.0",
  description: "2-personers telt, 3500mm vandsøjle",
  category_mapped: "telt",
  price: 299,
  price_original: 549,
  discount_pct: 46,
  in_stock: true,
  stock_count: null,
  image_url: "https://example.com/image.jpg",
  affiliate_url: "https://example.com/buy",
  is_blocked: false,
};

describe("GearCard editorial variant", () => {
  it("renders product name, price, and discount", () => {
    render(<GearCardView product={mockProduct} variant="editorial" />);
    expect(screen.getByText("Nordic Peak Thera 2.0")).toBeInTheDocument();
    expect(screen.getByText(/299/)).toBeInTheDocument();
    expect(screen.getByText(/549/)).toBeInTheDocument();
    expect(screen.getByText(/46/)).toBeInTheDocument();
  });

  it("uses rel='sponsored nofollow noopener' on the affiliate link", () => {
    render(<GearCardView product={mockProduct} variant="editorial" />);
    // The editorial variant has two links (affiliate + disclosure). Grab the
    // first one that points to the affiliate URL.
    const links = screen.getAllByRole("link");
    const affiliate = links.find(
      (l) => l.getAttribute("href") === mockProduct.affiliate_url
    );
    expect(affiliate).toBeDefined();
    expect(affiliate).toHaveAttribute("rel", "sponsored nofollow noopener");
    expect(affiliate).toHaveAttribute("target", "_blank");
  });

  it("shows the 'Annonce · Sponsoreret link' disclosure", () => {
    render(<GearCardView product={mockProduct} variant="editorial" />);
    expect(screen.getByText(/Annonce.*Sponsoreret/i)).toBeInTheDocument();
  });

  it("shows out-of-stock state when in_stock is false", () => {
    render(
      <GearCardView
        product={{ ...mockProduct, in_stock: false }}
        variant="editorial"
      />
    );
    expect(screen.getByText(/udsolgt/i)).toBeInTheDocument();
  });
});

describe("GearCard product variant", () => {
  it("renders product name, prominent discount badge, and Se tilbud button", () => {
    render(<GearCardView product={mockProduct} variant="product" />);
    expect(screen.getByText("Nordic Peak Thera 2.0")).toBeInTheDocument();
    expect(screen.getByText(/46/)).toBeInTheDocument(); // badge
    const links = screen.getAllByRole("link");
    const affiliate = links.find(
      (l) => l.getAttribute("href") === mockProduct.affiliate_url
    );
    expect(affiliate).toBeDefined();
    expect(affiliate).toHaveTextContent(/Se tilbud/i);
  });
  it("has a rel='sponsored' link", () => {
    render(<GearCardView product={mockProduct} variant="product" />);
    const links = screen.getAllByRole("link");
    const affiliate = links.find(
      (l) => l.getAttribute("href") === mockProduct.affiliate_url
    );
    expect(affiliate).toHaveAttribute("rel", "sponsored nofollow noopener");
  });
  it("does NOT show a strikethrough when price_original equals price (no real deal)", () => {
    const { container } = render(
      <GearCardView
        product={{ ...mockProduct, price: 399, price_original: 399, discount_pct: null }}
        variant="product"
      />
    );
    expect(container.querySelector(".line-through")).toBeNull();
  });
});

describe("GearCard pill variant", () => {
  it("renders as an inline element with product name and price", () => {
    render(<GearCardView product={mockProduct} variant="pill" />);
    expect(screen.getByText("Nordic Peak Thera 2.0")).toBeInTheDocument();
    expect(screen.getByText(/299/)).toBeInTheDocument();
  });
  it("uses rel='sponsored' on the link", () => {
    render(<GearCardView product={mockProduct} variant="pill" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "rel",
      "sponsored nofollow noopener"
    );
  });
});

describe("GearCard fallback states", () => {
  it("renders blocked products via the view (blocking happens in server wrapper)", () => {
    const blockedProduct = { ...mockProduct, is_blocked: true };
    const { container } = render(
      <GearCardView product={blockedProduct} variant="pill" />
    );
    // The view does NOT filter; the server wrapper does. This test documents
    // that contract — if this changes, update the contract.
    expect(container).not.toBeEmptyDOMElement();
  });
});
