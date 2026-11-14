import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProduktBillede } from "../ProduktBillede";

/**
 * To slags daarlige billeder, som komponenten haandterer forskelligt:
 *
 * LOVLIG  — en URL der ser rigtig ud. Om filen findes kan kun browseren sige,
 *           saa den forsoeges, og reserven kommer foerst ved onError.
 * UMULIG  — en URL med raat mellemrum. Den kan ikke virke (lib/affiliate-
 *           billede.ts), saa forsoeget springes over og reserven vises med det
 *           samme. Begge staar ordret i kataloget.
 *
 * De maa IKKE byttes om: bruger man UMULIG som fiksture for "fejler
 * undervejs", rendres der aldrig et <img>, fireEvent.error rammer en <div> og
 * goer ingenting — og testen bestaar uden at have vist noget som helst.
 */
const LOVLIG =
  "https://backpackerlife.dk/wp-content/uploads/2023/10/Stol-Treklife-High-back-UL-Chair-1.jpg";
const UMULIG =
  "https://backpackerlife.dk/wp-content/uploads/2025/06/Vandrestave- - -Highlander-Mull-4.jpg";

describe("ProduktBillede", () => {
  it("viser billedet, saa laenge det svarer", () => {
    render(<ProduktBillede src={LOVLIG} alt="Treklife High-back" width={44} height={44} />);
    expect(screen.getByRole("img", { name: "Treklife High-back" }).tagName).toBe("IMG");
  });

  it("skifter til reserven naar billedet fejler", () => {
    render(<ProduktBillede src={LOVLIG} alt="Treklife High-back" width={44} height={44} />);
    fireEvent.error(screen.getByRole("img", { name: "Treklife High-back" }));
    const reserve = screen.getByRole("img", { name: "Treklife High-back" });
    // Stadig tilgaengelig under samme navn, men ikke laengere et <img>.
    expect(reserve.tagName).toBe("DIV");
  });

  it("holder stoerrelsen, saa opstillingen ikke skrider", () => {
    render(<ProduktBillede src={LOVLIG} alt="Treklife High-back" width={44} height={44} />);
    fireEvent.error(screen.getByRole("img", { name: "Treklife High-back" }));
    const reserve = screen.getByRole("img", { name: "Treklife High-back" });
    expect(reserve).toHaveStyle({ width: "44px", height: "44px" });
  });

  it("daekker hele fladen ved fill, hvor foraelderen saetter stoerrelsen", () => {
    const { container } = render(
      <ProduktBillede src={LOVLIG} alt="Treklife High-back" fill className="object-contain" />
    );
    fireEvent.error(screen.getByRole("img", { name: "Treklife High-back" }));
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
    const { container } = render(<ProduktBillede src={LOVLIG} alt="" fill />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    const reserve = container.querySelector("div")!;
    expect(reserve.getAttribute("aria-hidden")).toBe("true");
    expect(reserve.getAttribute("role")).toBeNull();
  });

  it("forsoeger slet ikke en URL med raat mellemrum", () => {
    // Maalt 14/11-2026: 79 af 79 saadanne URL'er var 404, mod 0 af 100 uden.
    // Uden det her ville vi sende en forespoergsel vi VED fejler, og foerst
    // vise reserven naar svaret kom tilbage — et synligt glimt paa hvert kort.
    const { container } = render(
      <ProduktBillede src={UMULIG} alt="Highlander Mull" width={44} height={44} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Highlander Mull" }).tagName).toBe("DIV");
  });
});
