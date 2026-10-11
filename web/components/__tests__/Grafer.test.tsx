import { describe, expect, it, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
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
  it("tegner én synlig søjle og én usynlig tooltip-ramme pr. datapunkt", () => {
    // Rammen er fuldhøj og gennemsigtig, så man også kan pege på en dag
    // uden klik — dens søjle er 0 px høj og ellers umulig at ramme.
    const { container } = render(
      <Soejlegraf data={[
        { dato: "2026-10-09", vaerdi: 1 },
        { dato: "2026-10-10", vaerdi: 5 },
        { dato: "2026-10-11", vaerdi: 0 },
      ]} />);
    const alle = [...container.querySelectorAll("rect")];
    const synlige = alle.filter((r) => r.getAttribute("fill") !== "transparent");
    const rammer = alle.filter((r) => r.getAttribute("fill") === "transparent");
    expect(synlige).toHaveLength(3);
    expect(rammer).toHaveLength(3);
    // Også dagen uden klik har en ramme med en læsbar dato.
    expect(rammer[2].querySelector("title")?.textContent).toMatch(/11\. oktober: 0/);
  });

  it("navngiver dagen på dansk i tooltip, ikke som ISO-dato", () => {
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-10", vaerdi: 4 }]} enhed=" kr." />);
    const t = container.querySelector("rect[fill='transparent'] title")?.textContent ?? "";
    expect(t).toContain("lørdag");
    expect(t).toContain("10. oktober");
    expect(t).toContain("4 kr.");
  });

  it("giver den højeste værdi den højeste søjle", () => {
    const { container } = render(
      <Soejlegraf data={[
        { dato: "2026-10-10", vaerdi: 1 },
        { dato: "2026-10-11", vaerdi: 10 },
      ]} />);
    const h = [...container.querySelectorAll("rect")]
      .filter((r) => r.getAttribute("fill") !== "transparent")
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
    // Pilen er aria-hidden og ledsages af skjult tekst, så en skærmlæser
    // siger "op 50 %" og ikke "trekant 50 %". Dansk format: mellemrum før %.
    const op = render(<Retning nu={150} foer={100} />).container;
    expect(op.textContent).toMatch(/op\s*50 %/);
    expect(op.querySelector("[aria-hidden]")?.textContent).toBe("▲");
    cleanup();
    const ned = render(<Retning nu={50} foer={100} />).container;
    expect(ned.textContent).toMatch(/ned\s*50 %/);
    expect(ned.querySelector("[aria-hidden]")?.textContent).toBe("▼");
  });
});

describe("akse-mærkerne", () => {
  const mærker = (c: HTMLElement) => [...c.querySelectorAll("text")]
    .map((t) => t.textContent ?? "").filter((t) => /^[\d.]+$/.test(t));

  it("giver runde tal, også når maksimum er skævt", () => {
    // 25 som maksimum gav før 0 / 13 / 25, fordi kun toppen blev rundet.
    // Nu vælges trinnet først, og toppen følger af trinnet.
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-11", vaerdi: 25 }]} />);
    expect(mærker(container)).toEqual(["0", "10", "20", "30"]);
  });

  it("bruger ikke brudte trin på en akse der tæller hele ting", () => {
    // Maksimum 1 gav 0 / 0,25 / 0,5 / 0,75 / 1 — et kvart klik findes ikke.
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-11", vaerdi: 1 }]} />);
    expect(mærker(container)).toEqual(["0", "1"]);
  });

  it("skalerer til store beløb uden at miste runde tal", () => {
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-11", vaerdi: 196204 }]} enhed=" kr." />);
    expect(mærker(container)[1]).toBe("50.000");
  });

  it("holder den højeste søjle inden for grafen efter oprunding", () => {
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-11", vaerdi: 25 }]} />);
    const r = container.querySelector("rect:not([fill='transparent'])")!;
    expect(Number(r.getAttribute("y"))).toBeGreaterThan(0);
  });
});

describe("grafens bredde måles", () => {
  /** ResizeObserver findes ikke i jsdom; denne kan vi selv udløse. */
  function fakeRO() {
    const kaldt: Array<(e: Array<{ contentRect: { width: number } }>) => void> = [];
    class RO {
      constructor(cb: (e: Array<{ contentRect: { width: number } }>) => void) { kaldt.push(cb); }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", RO);
    return (bredde: number) => act(() => {
      for (const cb of kaldt) cb([{ contentRect: { width: bredde } }]);
    });
  }

  afterEach(() => { vi.unstubAllGlobals(); });

  it("sætter viewBox til containerens målte bredde, så skalaen bliver 1:1", () => {
    // Et fast viewBox med w-full gjorde skriftstørrelsen afhængig af
    // containeren: målt på dashboardet 16,3 px i en fuldbred graf og 7,7 px
    // i en halvbred. Samme kode, dobbelt så stor skrift det ene sted.
    const maal = fakeRO();
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-10", vaerdi: 3 }, { dato: "2026-10-11", vaerdi: 5 }]} />);
    maal(1206);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 1206 180");
    maal(572);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 572 180");
  });

  it("går ikke under minimumsbredden, så en telefon scroller i stedet", () => {
    const maal = fakeRO();
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-11", vaerdi: 3 }]} />);
    maal(343);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 560 180");
  });

  it("flytter søjlerne med, når bredden ændres", () => {
    // Hvis kun viewBox fulgte målingen, men koordinaterne var regnet på den
    // gamle bredde, ville grafen blive klippet eller efterlade tom plads.
    const maal = fakeRO();
    const { container } = render(
      <Soejlegraf data={[{ dato: "2026-10-10", vaerdi: 3 }, { dato: "2026-10-11", vaerdi: 5 }]} />);
    maal(1000);
    const sidsteX = () => Number([...container.querySelectorAll("rect:not([fill='transparent'])")]
      .pop()!.getAttribute("x"));
    const bred = sidsteX();
    maal(600);
    expect(sidsteX()).toBeLessThan(bred);
  });

  it("gælder også det stablede areal", () => {
    const maal = fakeRO();
    const { container } = render(
      <StabletAreal datoer={["2026-10-10", "2026-10-11"]}
        serier={[{ navn: "a", vaerdier: [1, 2] }]} />);
    maal(900);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 900 180");
  });
});
