import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";

const sporet = vi.fn();
vi.mock("@/lib/tracking", () => ({ trackAffiliateClick: (a: unknown) => sporet(a) }));

import { StayAffiliateLink } from "@/components/naturophold/StayAffiliateLink";

afterEach(() => { cleanup(); sporet.mockClear(); });

const BOOKING = "https://www.booking.com/hotel/dk/shelter-i-sansehave.en-gb.html?aid=356980";

describe("StayAffiliateLink", () => {
  it("pakker en Booking-adresse i CJ med placeringens SID", () => {
    const { container } = render(
      <StayAffiliateLink name="Shelter i Sansehave" url={BOOKING}
        linkSource="booking_com" position="naturophold_map" />);
    const href = container.querySelector("a")!.getAttribute("href")!;
    const u = new URL(href);
    expect(u.hostname).toBe("www.tkqlhce.com");
    expect(u.pathname).toBe("/click-101800945-15734870");
    expect(u.searchParams.get("sid")).toBe("kort");
    // Destinationen er ryddet: hverken fremmed aid eller engelsk sprog.
    expect(u.searchParams.get("url"))
      .toBe("https://www.booking.com/hotel/dk/shelter-i-sansehave.da.html");
  });

  it("giver hver placering sit eget SID", () => {
    const sids: string[] = [];
    for (const p of ["naturophold_map", "naturophold_planb", "naturophold_guide"] as const) {
      const { container } = render(
        <StayAffiliateLink name="x" url={BOOKING} linkSource="booking_com" position={p} />);
      sids.push(new URL(container.querySelector("a")!.href).searchParams.get("sid")!);
      cleanup();
    }
    expect(sids).toEqual(["kort", "shelter", "guide"]);
    expect(new Set(sids).size).toBe(3);
  });

  it("maaler den adresse brugeren faktisk sendes til", () => {
    // Sporede vi den gemte adresse og ikke deeplinket, ville vores egne tal
    // ikke kunne stemmes af mod CJ's.
    const { container } = render(
      <StayAffiliateLink name="x" url={BOOKING} linkSource="booking_com" position="naturophold_map" />);
    const a = container.querySelector("a")!;
    fireEvent.click(a);
    expect(sporet).toHaveBeenCalledTimes(1);
    expect(sporet.mock.calls[0][0].url).toBe(a.getAttribute("href"));
    expect(sporet.mock.calls[0][0].url).toContain("tkqlhce.com");
  });

  it("lader et link uden for Booking gaa uroert igennem", () => {
    const { container } = render(
      <StayAffiliateLink name="x" url="https://landjord.dk/sted/x"
        linkSource="andet_netvaerk" position="naturophold_planb" />);
    expect(container.querySelector("a")!.getAttribute("href")).toBe("https://landjord.dk/sted/x");
  });

  it("beholder rel-attributterne paa det byggede link", () => {
    const { container } = render(
      <StayAffiliateLink name="x" url={BOOKING} linkSource="booking_com" position="naturophold_map" />);
    expect(container.querySelector("a")!.getAttribute("rel")).toBe("sponsored nofollow noopener");
  });

  it("viser 'Link mangler' frem for en doed knap", () => {
    const { container } = render(
      <StayAffiliateLink name="x" url={null} linkSource="booking_com" position="naturophold_map" />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Link mangler");
  });
});
