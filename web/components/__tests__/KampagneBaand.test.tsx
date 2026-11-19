import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let sti = "/";
vi.mock("next/navigation", () => ({ usePathname: () => sti }));
const trackKampagneBaandClick = vi.fn();
vi.mock("@/lib/tracking", () => ({ trackKampagneBaandClick: (k: string) => trackKampagneBaandClick(k) }));

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
    render(<KampagneBaandLink kampagne="black-friday" aar={2026} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/black-friday");
    expect(link.textContent).toContain("Black Friday 2026");
  });

  it("maaler klikket", () => {
    render(<KampagneBaandLink kampagne="black-friday" aar={2026} />);
    fireEvent.click(screen.getByRole("link"));
    expect(trackKampagneBaandClick).toHaveBeenCalledTimes(1);
    expect(trackKampagneBaandClick).toHaveBeenCalledWith("black-friday");
  });

  it.each(["/black-friday", "/admin", "/admin/nyhedsbrev", "/owner/abc", "/book/x", "/booking/y", "/min-booking", "/aktiver-booking"])(
    "vises ikke paa %s",
    (p) => {
      sti = p;
      const { container } = render(<KampagneBaandLink kampagne="black-friday" aar={2026} />);
      expect(container.innerHTML).toBe("");
    }
  );

  it.each(["/", "/by/aarhus", "/bedste/sovepose", "/booking-guide", "/administration"])(
    "vises paa %s",
    (p) => {
      // De to sidste ligner de skjulte stier, men er det ikke. Praefikset skal
      // matche et helt stiled.
      sti = p;
      render(<KampagneBaandLink kampagne="black-friday" aar={2026} />);
      expect(screen.getByRole("link")).toBeInTheDocument();
    }
  );

  describe("julegaver", () => {
    it("linker til /julegaver og maaler klikket som julegaver", () => {
      render(<KampagneBaandLink kampagne="julegaver" aar={2026} />);
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/julegaver");
      expect(link.textContent).toContain("Julegaver");
      fireEvent.click(link);
      expect(trackKampagneBaandClick).toHaveBeenCalledWith("julegaver");
    });

    it("skjules paa /julegaver, men ikke paa /black-friday", () => {
      sti = "/julegaver";
      const { container, unmount } = render(<KampagneBaandLink kampagne="julegaver" aar={2026} />);
      expect(container.innerHTML).toBe("");
      unmount();
      sti = "/black-friday";
      render(<KampagneBaandLink kampagne="julegaver" aar={2026} />);
      expect(screen.getByRole("link")).toBeInTheDocument();
    });

    it("skjules stadig i booking og admin", () => {
      sti = "/book/x";
      const { container } = render(<KampagneBaandLink kampagne="julegaver" aar={2026} />);
      expect(container.innerHTML).toBe("");
    });
  });
});
