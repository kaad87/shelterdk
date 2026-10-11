import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  Soejlegraf, StabletAreal, Sparkline, Bjaelker, Varmekort, Retning,
} from "@/components/admin/Grafer";

afterEach(cleanup);

/**
 * Graferne er rene funktioner af deres props, men de regner koordinater.
 * En off-by-one i en y-skala giver ingen fejl — den giver en graf der ligner
 * noget, og lyver. Derfor tjekkes de faktiske tal i SVG'et.
 */
describe("Soejlegraf", () => {
  it("tegner én søjle pr. datapunkt", () => {
    const { container } = render(
      <Soejlegraf data={[
        { dato: "2026-10-09", vaerdi: 1 },
        { dato: "2026-10-10", vaerdi: 5 },
        { dato: "2026-10-11", vaerdi: 3 },
      ]} />);
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  it("giver den højeste værdi den højeste søjle", () => {
    const { container } = render(
      <Soejlegraf data={[
        { dato: "2026-10-10", vaerdi: 1 },
        { dato: "2026-10-11", vaerdi: 10 },
      ]} />);
    const h = [...container.querySelectorAll("rect")]
      .map((r) => Number(r.getAttribute("height")));
    expect(h[1]).toBeGreaterThan(h[0]);
  });

  it("tegner ikke en søjle med negativ højde når værdien er nul", () => {
    // Math.max(0, …) på højden: en negativ height er ugyldig SVG, og
    // browseren dropper hele rektanglet uden at sige noget.
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-11", vaerdi: 0 }]} />);
    for (const r of container.querySelectorAll("rect")) {
      expect(Number(r.getAttribute("height"))).toBeGreaterThanOrEqual(0);
    }
  });

  it("overlever et datasæt hvor alt er nul", () => {
    // maks ville være 0, og y() ville dividere med nul.
    const { container } = render(
      <Soejlegraf data={[
        { dato: "2026-10-10", vaerdi: 0 }, { dato: "2026-10-11", vaerdi: 0 },
      ]} />);
    for (const r of container.querySelectorAll("rect, polyline")) {
      expect(r.outerHTML).not.toMatch(/NaN|Infinity/);
    }
  });

  it("siger det, når der ikke er data, i stedet for at tegne en tom akse", () => {
    const { container } = render(<Soejlegraf data={[]} />);
    expect(container.textContent).toContain("Ingen data");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("tegner den glidende linje med et punkt pr. dag", () => {
    const { container } = render(
      <Soejlegraf data={[
        { dato: "2026-10-10", vaerdi: 2 }, { dato: "2026-10-11", vaerdi: 4 },
      ]} linje={[2, 3]} />);
    const p = container.querySelector("polyline")?.getAttribute("points") ?? "";
    expect(p.trim().split(/\s+/)).toHaveLength(2);
    expect(p).not.toMatch(/NaN/);
  });
});

describe("StabletAreal", () => {
  it("tegner én flade pr. serie", () => {
    const { container } = render(
      <StabletAreal datoer={["2026-10-10", "2026-10-11"]} serier={[
        { navn: "a", vaerdier: [1, 2] }, { navn: "b", vaerdier: [3, 1] },
      ]} />);
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("stabler, så den øverste flade følger totalen", () => {
    // Stables der ikke, overlapper fladerne og grafen underdriver totalen.
    const { container } = render(
      <StabletAreal datoer={["2026-10-10", "2026-10-11"]} serier={[
        { navn: "a", vaerdier: [5, 5] }, { navn: "b", vaerdier: [5, 5] },
      ]} />);
    const y = (i: number) => Number(
      container.querySelectorAll("path")[i].getAttribute("d")!.match(/M[\d.]+,([\d.]+)/)![1]);
    // Serie b's top ligger højere oppe (lavere y) end serie a's.
    expect(y(1)).toBeLessThan(y(0));
  });

  it("navngiver serierne i signaturen", () => {
    const { container } = render(
      <StabletAreal datoer={["2026-10-11"]} serier={[{ navn: "outmore", vaerdier: [1] }]} />);
    expect(container.textContent).toContain("outmore");
  });

  it("tåler en enkelt dato uden at dividere med nul", () => {
    const { container } = render(
      <StabletAreal datoer={["2026-10-11"]} serier={[{ navn: "a", vaerdier: [3] }]} />);
    expect(container.querySelector("path")?.getAttribute("d")).not.toMatch(/NaN|Infinity/);
  });
});

describe("Sparkline", () => {
  it("kræver mindst to punkter for at tegne en linje", () => {
    const { container } = render(<Sparkline tal={[5]} />);
    expect(container.querySelector("polyline")).toBeNull();
  });
  it("tegner uden NaN når alle værdier er nul", () => {
    const { container } = render(<Sparkline tal={[0, 0, 0]} />);
    expect(container.querySelector("polyline")?.getAttribute("points")).not.toMatch(/NaN/);
  });
});

describe("Bjaelker", () => {
  it("giver den største post fuld bredde", () => {
    const { container } = render(<Bjaelker poster={[
      { navn: "a", vaerdi: 10 }, { navn: "b", vaerdi: 5 },
    ]} />);
    const w = [...container.querySelectorAll<HTMLElement>("div[style*='width']")]
      .map((d) => d.style.width);
    expect(w[0]).toBe("100%");
    expect(w[1]).toBe("50%");
  });
  it("dividerer ikke med nul når alle poster er nul", () => {
    const { container } = render(<Bjaelker poster={[{ navn: "a", vaerdi: 0 }]} />);
    expect(container.querySelector<HTMLElement>("div[style*='width']")?.style.width).toBe("0%");
  });
});

describe("Varmekort", () => {
  it("tegner 7 × 24 celler", () => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    const { container } = render(<Varmekort grid={grid} />);
    expect(container.querySelectorAll("rect")).toHaveLength(168);
  });
  it("gør den travleste celle mest mættet", () => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    grid[0][8] = 1; grid[0][9] = 10;
    const { container } = render(<Varmekort grid={grid} />);
    const r = [...container.querySelectorAll("rect")];
    expect(Number(r[9].getAttribute("fill-opacity")))
      .toBeGreaterThan(Number(r[8].getAttribute("fill-opacity")));
  });
});

describe("Retning", () => {
  it("skelner mellem 'ingen ændring' og 'intet at sammenligne med'", () => {
    // 0 % og "nyt" er forskellige svar. Division med foer=0 gav Infinity.
    expect(render(<Retning nu={0} foer={0} />).container.textContent).toContain("uændret");
    cleanup();
    expect(render(<Retning nu={5} foer={0} />).container.textContent).toContain("ny aktivitet");
  });
  it("regner retningen og fortegnet", () => {
    // Dansk format: mellemrum foran procenttegnet.
    expect(render(<Retning nu={150} foer={100} />).container.textContent).toMatch(/▲ 50 %/);
    cleanup();
    expect(render(<Retning nu={50} foer={100} />).container.textContent).toMatch(/▼ 50 %/);
  });
});
