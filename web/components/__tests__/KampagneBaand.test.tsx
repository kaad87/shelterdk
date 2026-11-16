import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let sti = "/";
vi.mock("next/navigation", () => ({ usePathname: () => sti }));
const trackKampagneBaandClick = vi.fn();
vi.mock("@/lib/tracking", () => ({ trackKampagneBaandClick: () => trackKampagneBaandClick() }));

import { KampagneBaandLink } from "../KampagneBaandLink";

beforeEach(() => {
  sti = "/";
  trackKampagneBaandClick.mockReset();
});

describe("KampagneBaandLink", () => {
  it("linker til /black-friday uden parametre", () => {
    // Ingen ?fra= paa linket: baandet staar paa alle sider, og en parameter
    // ville give Google tusindvis af links til en dublet af siden. Klikket
    // maales med et event i stedet.
    render(<KampagneBaandLink aar={2026} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/black-friday");
    expect(link.textContent).toContain("Black Friday 2026");
  });

  it("maaler klikket", () => {
    render(<KampagneBaandLink aar={2026} />);
    fireEvent.click(screen.getByRole("link"));
    expect(trackKampagneBaandClick).toHaveBeenCalledTimes(1);
  });

  it.each(["/black-friday", "/admin", "/admin/nyhedsbrev", "/owner/abc", "/book/x", "/booking/y", "/min-booking", "/aktiver-booking"])(
    "vises ikke paa %s",
    (p) => {
      sti = p;
      const { container } = render(<KampagneBaandLink aar={2026} />);
      expect(container.innerHTML).toBe("");
    }
  );

  it.each(["/", "/by/aarhus", "/bedste/sovepose", "/booking-guide", "/administration"])(
    "vises paa %s",
    (p) => {
      // De to sidste ligner de skjulte stier, men er det ikke. Praefikset skal
      // matche et helt stiled.
      sti = p;
      render(<KampagneBaandLink aar={2026} />);
      expect(screen.getByRole("link")).toBeInTheDocument();
    }
  );
});
