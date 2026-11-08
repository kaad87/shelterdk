import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProduktBillede } from "../ProduktBillede";

// Den doede URL herunder staar ordret i kataloget 8. november 2026 og giver
// 404: backpackerlife har slettet filen, og synken skriver den igen hver nat.
const DOED =
  "https://backpackerlife.dk/wp-content/uploads/2025/06/Vandrestave- - -Highlander-Mull-4.jpg";

describe("ProduktBillede", () => {
  it("viser billedet, saa laenge det svarer", () => {
    render(<ProduktBillede src={DOED} alt="Highlander Mull" width={44} height={44} />);
    expect(screen.getByRole("img", { name: "Highlander Mull" }).tagName).toBe("IMG");
  });

  it("skifter til reserven naar billedet fejler", () => {
    render(<ProduktBillede src={DOED} alt="Highlander Mull" width={44} height={44} />);
    fireEvent.error(screen.getByRole("img", { name: "Highlander Mull" }));
    const reserve = screen.getByRole("img", { name: "Highlander Mull" });
    // Stadig tilgaengelig under samme navn, men ikke laengere et <img>.
    expect(reserve.tagName).toBe("DIV");
  });

  it("holder stoerrelsen, saa opstillingen ikke skrider", () => {
    render(<ProduktBillede src={DOED} alt="Highlander Mull" width={44} height={44} />);
    fireEvent.error(screen.getByRole("img", { name: "Highlander Mull" }));
    const reserve = screen.getByRole("img", { name: "Highlander Mull" });
    expect(reserve).toHaveStyle({ width: "44px", height: "44px" });
  });

  it("daekker hele fladen ved fill, hvor foraelderen saetter stoerrelsen", () => {
    const { container } = render(
      <ProduktBillede src={DOED} alt="Highlander Mull" fill className="object-contain" />
    );
    fireEvent.error(screen.getByRole("img", { name: "Highlander Mull" }));
    const reserve = container.querySelector("div");
    expect(reserve?.className).toContain("absolute inset-0");
    // Billedets egne klasser hoerer til billedet, ikke til reserven.
    expect(reserve?.className).not.toContain("object-contain");
  });

  it("viser reserven med det samme, naar der slet ingen URL er", () => {
    render(<ProduktBillede src={null} alt="Uden billede" width={44} height={44} />);
    expect(screen.getByRole("img", { name: "Uden billede" }).tagName).toBe("DIV");
    expect(screen.queryByRole("img", { name: "Uden billede" })?.tagName).not.toBe("IMG");
  });

  it("behandler en tom streng som ingen URL", () => {
    render(<ProduktBillede src="   " alt="Kun mellemrum" width={44} height={44} />);
    expect(screen.getByRole("img", { name: "Kun mellemrum" }).tagName).toBe("DIV");
  });

  it("skjuler reserven for skaermlaesere, naar billedet var dekorativt", () => {
    // alt="" bruges hvor navnet alligevel staar som tekst ved siden af.
    const { container } = render(<ProduktBillede src={DOED} alt="" fill />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    const reserve = container.querySelector("div")!;
    expect(reserve.getAttribute("aria-hidden")).toBe("true");
    expect(reserve.getAttribute("role")).toBeNull();
  });
});
