import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const trackGuideTeaserClick = vi.fn();
const trackGearSuggestionClick = vi.fn();
vi.mock("@/lib/tracking", () => ({
  trackGuideTeaserClick: (a: unknown) => trackGuideTeaserClick(a),
  trackGearSuggestionClick: (a: unknown) => trackGearSuggestionClick(a),
}));

import { PrisfaldMaerke } from "../PrisfaldMaerke";
import { GuideTeaserLink } from "../GuideTeaserLink";
import { GearSuggestionLink } from "../GearSuggestionLink";

beforeEach(() => {
  trackGuideTeaserClick.mockReset();
  trackGearSuggestionClick.mockReset();
});

const guide = { slug: "sovepose", title: "Bedste sovepose", reason: "Til kolde naetter" };

describe("PrisfaldMaerke", () => {
  it("bøjer efter antallet", () => {
    const { rerender } = render(<PrisfaldMaerke antal={1} />);
    expect(screen.getByText("1 vare faldet i pris")).toBeInTheDocument();
    rerender(<PrisfaldMaerke antal={3} />);
    expect(screen.getByText("3 varer faldet i pris")).toBeInTheDocument();
  });

  it("viser intet uden prisfald", () => {
    const { container } = render(<PrisfaldMaerke antal={0} />);
    expect(container.innerHTML).toBe("");
    const { container: c2 } = render(<PrisfaldMaerke antal={undefined} />);
    expect(c2.innerHTML).toBe("");
  });
});

describe("maerket paa guide-links", () => {
  it.each(["kort", "liste"] as const)("GuideTeaserLink (%s) viser det og maaler det", (variant) => {
    render(<GuideTeaserLink guide={{ ...guide, prisfald: 2 }} kilde="forside" variant={variant} />);
    expect(screen.getByText("2 varer faldet i pris")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link"));
    expect(trackGuideTeaserClick).toHaveBeenCalledWith(expect.objectContaining({ prisfald: 2 }));
  });

  it("GearSuggestionLink viser det og maaler det", () => {
    render(<GearSuggestionLink guide={{ ...guide, prisfald: 1 }} shelterSlug="x" />);
    expect(screen.getByText("1 vare faldet i pris")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link"));
    expect(trackGearSuggestionClick).toHaveBeenCalledWith(expect.objectContaining({ prisfald: 1 }));
  });

  it("maaler 0, naar linket intet maerke har", () => {
    // Saa klikraten med og uden maerke kan sammenlignes i internal_events.
    render(<GearSuggestionLink guide={guide} shelterSlug="x" />);
    expect(screen.queryByText(/faldet i pris/)).toBeNull();
    fireEvent.click(screen.getByRole("link"));
    expect(trackGearSuggestionClick).toHaveBeenCalledWith(expect.objectContaining({ prisfald: 0 }));
  });
});
