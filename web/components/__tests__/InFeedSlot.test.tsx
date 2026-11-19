import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/AdInFeed", () => ({ AdInFeed: () => <div data-testid="adsense" /> }));
vi.mock("@/components/AffiliateInFeedCard", () => ({
  AffiliateInFeedCard: ({ vare, plads }: { vare: { produktId: string }; plads: number }) => (
    <div data-testid="kort">{`${vare.produktId}@${plads}`}</div>
  ),
}));

import { InFeedSlot } from "@/components/InFeedSlot";
import type { InFeedAnnonce, InFeedVare } from "@/lib/infeed-annonce";

const vare = (produktId: string) => ({ produktId }) as unknown as InFeedVare;

describe("InFeedSlot", () => {
  // November 2026: foer kunne kun plads 0 blive et produktkort.
  it("viser et produktkort paa alle tre pladser i en affiliate-arm", () => {
    const annonce: InFeedAnnonce = { arm: "ren", varer: [vare("a"), vare("b"), vare("c")] };
    for (const [nr, forventet] of [[0, "a@0"], [1, "b@1"], [2, "c@2"]] as const) {
      const { unmount } = render(<InFeedSlot nr={nr} annonce={annonce} />);
      expect(screen.getByTestId("kort").textContent).toBe(forventet);
      unmount();
    }
  });

  it("falder tilbage til AdSense paa en plads uden vare", () => {
    render(<InFeedSlot nr={2} annonce={{ arm: "tilbud", varer: [vare("a")] }} />);
    expect(screen.getByTestId("adsense")).toBeTruthy();
  });

  it("viser AdSense i adsense-armen og uden annonce", () => {
    const { unmount } = render(<InFeedSlot nr={0} annonce={{ arm: "adsense", varer: [] }} />);
    expect(screen.getByTestId("adsense")).toBeTruthy();
    unmount();
    render(<InFeedSlot nr={0} annonce={null} />);
    expect(screen.getByTestId("adsense")).toBeTruthy();
  });
});
