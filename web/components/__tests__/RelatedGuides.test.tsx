import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RelatedGuides } from "@/components/buying-guide/RelatedGuides";
import type { HubGuide } from "@/lib/buying-guides-hub";

afterEach(cleanup);

const g = (slug: string): HubGuide =>
  ({ slug, title: `Bedste ${slug}`, category: "telt", parent_slug: null } as HubGuide);

describe("RelatedGuides", () => {
  it("linker til navet, ikke kun til søskende", () => {
    // Målt på det levende site havde /bedste tre kontekstuelle indgående
    // links i alt — navet for 38 guider og 96 % af affiliate-indtægten.
    // Guidesiderne nåede det kun via brødkrumme og footer.
    const { container } = render(<RelatedGuides guides={[g("telt"), g("tarp")]} ialt={38} />);
    const hub = [...container.querySelectorAll("a")]
      .filter((a) => a.getAttribute("href") === "/bedste");
    expect(hub).toHaveLength(1);
    expect(hub[0].textContent).toBe("Se alle 38 købsguider");
  });

  it("sætter nav-linket efter forslagene, ikke før", () => {
    // Læseren skal se de relevante forslag først; "se alle" er faldbakken.
    const { container } = render(<RelatedGuides guides={[g("telt")]} ialt={38} />);
    const href = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(href).toEqual(["/bedste/telt", "/bedste"]);
  });

  it("siger bare 'alle', når antallet ikke er kendt", () => {
    const { container } = render(<RelatedGuides guides={[g("telt")]} />);
    expect(container.textContent).toContain("Se alle købsguider");
    expect(container.textContent).not.toMatch(/alle \d/);
  });

  it("siger ikke 'alle 0'", () => {
    const { container } = render(<RelatedGuides guides={[g("telt")]} ialt={0} />);
    expect(container.textContent).toContain("Se alle købsguider");
  });

  it("render intet, når der ikke er nogen forslag", () => {
    // Uden søskende er der ingen blok — og så heller intet nav-link, så en
    // tom sektion ikke står og peger på sig selv.
    const { container } = render(<RelatedGuides guides={[]} ialt={38} />);
    expect(container.innerHTML).toBe("");
  });
});
