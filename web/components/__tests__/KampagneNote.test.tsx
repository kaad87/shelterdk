import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KampagneNote } from "../KampagneNote";

const paa = (s: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${s}T12:00:00Z`));
};
afterEach(() => vi.useRealTimers());

const hrefs = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

describe("KampagneNote", () => {
  it("linker til baade Black Friday og julegaver fra hubben i Black Week", () => {
    paa("2026-11-19");
    render(<KampagneNote variant="hub" />);
    expect(hrefs()).toEqual(["/black-friday", "/julegaver"]);
  });

  it("holder guiden til Black Friday alene i Black Week", () => {
    paa("2026-11-19");
    render(<KampagneNote variant="guide" />);
    expect(hrefs()).toEqual(["/black-friday"]);
  });

  it("linker kun til julegaver efter Cyber Monday", () => {
    paa("2026-12-05");
    for (const variant of ["hub", "guide"] as const) {
      const { unmount } = render(<KampagneNote variant={variant} />);
      expect(hrefs(), variant).toEqual(["/julegaver"]);
      unmount();
    }
  });

  it("renderer intet efter 21. december", () => {
    paa("2026-12-22");
    const { container } = render(<KampagneNote variant="hub" />);
    expect(container.innerHTML).toBe("");
  });
});
