import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const seen = vi.fn();
vi.mock("@/lib/tracking", () => ({ trackGearBlockSeen: (a: unknown) => seen(a) }));

import { GearBlockImpression } from "@/components/GearBlockImpression";

/** Minimal IntersectionObserver vi selv kan udløse. */
function fakeObserver() {
  const kaldt: Array<(p: Array<{ isIntersecting: boolean }>) => void> = [];
  const disconnect = vi.fn();
  const observeret: Element[] = [];
  class IO {
    constructor(cb: (p: Array<{ isIntersecting: boolean }>) => void) {
      kaldt.push(cb);
    }
    observe(el: Element) {
      observeret.push(el);
    }
    disconnect = disconnect;
  }
  vi.stubGlobal("IntersectionObserver", IO as unknown as typeof IntersectionObserver);
  return {
    kryds: () => kaldt.forEach((cb) => cb([{ isIntersecting: true }])),
    forbi: () => kaldt.forEach((cb) => cb([{ isIntersecting: false }])),
    observeret,
    disconnect,
  };
}

describe("GearBlockImpression", () => {
  beforeEach(() => seen.mockClear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("melder ikke før blokken er i viewporten", () => {
    const io = fakeObserver();
    render(<GearBlockImpression shelterSlug="dalby" guideCount={3} />);
    expect(seen).not.toHaveBeenCalled();
    io.forbi();
    expect(seen).not.toHaveBeenCalled();
  });

  it("observerer et element med areal, ikke det punktformede anker", () => {
    // Tærsklen på 0,5 kan intet afgøre på et element uden areal: specifikationen
    // sætter ratio til 1, så snart det skærer viewporten. Observeres forælderen,
    // betyder tærsklen det kommentaren siger.
    const io = fakeObserver();
    const { container } = render(<GearBlockImpression shelterSlug="dalby" guideCount={3} />);
    expect(io.observeret[0]).not.toBe(container.querySelector("span"));
    expect(io.observeret[0]).toBe(container.firstElementChild?.parentElement ?? container);
  });

  it("melder én gang når blokken krydser ind", () => {
    const io = fakeObserver();
    render(<GearBlockImpression shelterSlug="dalby" guideCount={3} />);
    io.kryds();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ shelterSlug: "dalby", guideCount: 3 });
  });

  it("melder ikke igen ved gentagne kryds", () => {
    const io = fakeObserver();
    render(<GearBlockImpression shelterSlug="dalby" guideCount={2} />);
    io.kryds();
    io.kryds();
    io.kryds();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("falder tilbage til at melde straks uden IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<GearBlockImpression shelterSlug="kaloe" guideCount={1} />);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
