import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useAdSlot, AD_MIN_WIDTH } from "../useAdSlot";

/**
 * jsdom layouter ikke og har hverken ResizeObserver eller IntersectionObserver,
 * så begge styres manuelt: `setWidth` bestemmer hvad elementet "måler",
 * `flushResize` fyrer resize-observeren som browseren ville efter en
 * layout-ændring, og `scrollIntoView` simulerer at pladsen nærmer sig skærmen.
 *
 * Som standard starter hver test UDEN for viewporten — det er den tilstand de
 * fleste annoncer på en side er i, og gaten skal holde dem der.
 */
let currentWidth = 0;
let resizeCbs: (() => void)[] = [];
let intersectCbs: ((entries: { isIntersecting: boolean }[]) => void)[] = [];

function setWidth(w: number) {
  currentWidth = w;
}
function flushResize() {
  act(() => {
    resizeCbs.forEach((cb) => cb());
  });
}
/** Lader pladsen komme i syne — først dér må annoncen hentes. */
function scrollIntoView() {
  act(() => {
    intersectCbs.forEach((cb) => cb([{ isIntersecting: true }]));
  });
}

beforeEach(() => {
  currentWidth = 0;
  resizeCbs = [];
  intersectCbs = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
        resizeCbs.push(cb);
      }
      observe() {}
      disconnect() {
        resizeCbs = resizeCbs.filter((o) => o !== this.cb);
      }
      unobserve() {}
    }
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      cb: (entries: { isIntersecting: boolean }[]) => void;
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        this.cb = cb;
        intersectCbs.push(cb);
      }
      observe() {}
      disconnect() {
        intersectCbs = intersectCbs.filter((o) => o !== this.cb);
      }
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
  );
  Element.prototype.getBoundingClientRect = function () {
    return { width: currentWidth, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
  } as never;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ minWidth }: { minWidth?: number }) {
  const { boxRef, ready, tooNarrow } = useAdSlot(minWidth);
  return (
    <div ref={boxRef} data-testid="box" data-ready={String(ready)} data-narrow={String(tooNarrow)}>
      {ready && <ins data-testid="ins" className="adsbygoogle" />}
    </div>
  );
}

const state = (c: ReturnType<typeof render>) => {
  const box = c.getByTestId("box");
  return {
    ready: box.getAttribute("data-ready") === "true",
    tooNarrow: box.getAttribute("data-narrow") === "true",
    hasIns: !!c.queryByTestId("ins"),
  };
};

describe("useAdSlot – viewport-gate", () => {
  it("henter IKKE annoncen når pladsen er langt nede på siden", () => {
    // Kernen i viewability-problemet: annoncer på plads 12 og 18 blev hentet ved
    // sideindlæsning selv om ingen scrollede derned.
    setWidth(600);
    const c = render(<Probe />);
    expect(state(c)).toMatchObject({ ready: false, hasIns: false });
  });

  it("henter annoncen når pladsen nærmer sig skærmen", () => {
    setWidth(600);
    const c = render(<Probe />);
    expect(state(c).hasIns).toBe(false);
    scrollIntoView();
    expect(state(c)).toMatchObject({ ready: true, hasIns: true });
  });

  it("holder gaten lukket selv om beholderen ændrer størrelse", () => {
    setWidth(600);
    const c = render(<Probe />);
    setWidth(900);
    flushResize();
    expect(state(c).hasIns).toBe(false);
  });
});

describe("useAdSlot – bredde", () => {
  it("renderer ikke <ins> ved bredde 0 — det var availableWidth=0-fejlen", () => {
    setWidth(0);
    const c = render(<Probe />);
    scrollIntoView();
    expect(state(c)).toMatchObject({ ready: false, hasIns: false });
    // Bredde 0 må IKKE tolkes som "for smal" — vi ved endnu ingenting.
    expect(state(c).tooNarrow).toBe(false);
  });

  it("skubber når beholderen er bred nok og i syne", () => {
    setWidth(600);
    const c = render(<Probe />);
    scrollIntoView();
    expect(state(c)).toMatchObject({ ready: true, hasIns: true, tooNarrow: false });
  });

  it("udvider sig i stedet for at fejle ved 240 px — det var fluid-fejlen", () => {
    setWidth(240);
    const c = render(<Probe />);
    scrollIntoView();
    expect(state(c)).toMatchObject({ ready: false, hasIns: false, tooNarrow: true });

    // Kaldestedet har nu spændt boksen over hele rækken.
    setWidth(515);
    flushResize();
    expect(state(c)).toMatchObject({ ready: true, hasIns: true });
  });

  it("kommer med når en skjult beholder senere får bredde", () => {
    setWidth(0);
    const c = render(<Probe />);
    scrollIntoView();
    expect(state(c).hasIns).toBe(false);

    setWidth(728);
    flushResize();
    expect(state(c).hasIns).toBe(true);
  });

  it("låser udvidelsen, så en bredde lige omkring grænsen ikke oscillerer", () => {
    // Regression: uden låsen ville tooNarrow gå true→false→true i det uendelige,
    // fordi udvidelsen fjernes igen så snart målingen blev god.
    setWidth(AD_MIN_WIDTH - 1);
    const c = render(<Probe />);
    scrollIntoView();
    expect(state(c).tooNarrow).toBe(true);

    setWidth(AD_MIN_WIDTH + 10);
    flushResize();
    expect(state(c)).toMatchObject({ ready: true, hasIns: true });
    // Udvidelsen skal bestå — ellers krymper boksen og vi er tilbage i løkken.
    expect(state(c).tooNarrow).toBe(true);
  });

  it("skubber kun én gang selv om observerne fyrer igen", () => {
    setWidth(600);
    const c = render(<Probe />);
    scrollIntoView();
    expect(state(c).hasIns).toBe(true);
    const before = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle?.length ?? 0;
    flushResize();
    scrollIntoView();
    flushResize();
    const after = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle?.length ?? 0;
    expect(after).toBe(before);
  });
});
