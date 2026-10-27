import { describe, it, expect } from "vitest";
import { retOrd, retTekst, retTestpaastand } from "../ret-tekstkvalitet";

describe("retTestpaastand", () => {
  it("fjerner paastanden om et testforloeb, men beholder sammenligningen", () => {
    expect(retTestpaastand("Dyrest i testen")).toBe("Dyrest i udvalget");
    expect(retTestpaastand("Hurtigst i test")).toBe("Hurtigst i udvalget");
    expect(retTestpaastand("Varmest i testen.")).toBe("Varmest i udvalget.");
    expect(retTestpaastand("den laveste pris i testen — fin hverdagssok")).toBe(
      "den laveste pris i udvalget — fin hverdagssok"
    );
  });

  it("beholder stort begyndelsesbogstav fra kilden", () => {
    expect(retTestpaastand("I testen var den dyrest")).toBe("I udvalget var den dyrest");
  });

  it("roerer ikke ord der bare begynder med test", () => {
    // Uden ordgraensen efter "test" ville de her blive til noget vroevl.
    expect(retTestpaastand("vi har ikke testet den")).toBe("vi har ikke testet den");
    expect(retTestpaastand("i testede forhold")).toBe("i testede forhold");
    expect(retTestpaastand("i testrapporten")).toBe("i testrapporten");
  });

  it("er idempotent", () => {
    const en = retTestpaastand("Dyrest i testen");
    expect(retTestpaastand(en)).toBe(en);
  });
});

describe("retTekst samler rettelserne", () => {
  it("retter baade bogstaver, feed-jargon og testpaastand i samme felt", () => {
    expect(retTekst("Vaegten er ikke oplyst i feedet. Dyrest i testen.")).toBe(
      "Vægten er ikke oplyst af forhandleren. Dyrest i udvalget."
    );
  });

  it("lader slugs i URL'er staa", () => {
    // "stormkoekken" og "taendstaal" ER de rigtige slugs og maa ikke rettes.
    expect(retTekst("Se [guiden](/bedste/stormkoekken) og /bedste/taendstaal")).toBe(
      "Se [guiden](/bedste/stormkoekken) og /bedste/taendstaal"
    );
  });

  it("er idempotent", () => {
    const kilde = "Vaegten er ikke oplyst i feedet. Dyrest i testen. Se /bedste/oekse";
    const en = retTekst(kilde);
    expect(retTekst(en)).toBe(en);
  });
});

describe("retOrd", () => {
  it("retter kun ordene paa listen", () => {
    expect(retOrd("paa saadan vaegten pakmaal medfoelgende")).toBe(
      "på sådan vægten pakmål medfølgende"
    );
  });

  it("lader rigtige danske ord med samme bogstavpar vaere", () => {
    expect(retOrd("skoen kanoen broen risikoen ponchoer tempoet")).toBe(
      "skoen kanoen broen risikoen ponchoer tempoet"
    );
  });
});
