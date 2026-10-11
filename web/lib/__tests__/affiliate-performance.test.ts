import { describe, it, expect } from "vitest";
import {
  dagligSerie, glidende, grupper, guideSlug, noegletal, topProdukter,
  varmekort, prisfordeling, dkDato, dkUgedag,
  type KlikRaekke, type EventRaekke,
} from "@/lib/affiliate-performance";

const NU = new Date("2026-10-11T12:00:00Z");

function klik(over: Partial<KlikRaekke> = {}): KlikRaekke {
  return {
    created_at: "2026-10-11T10:00:00Z", path: "/bedste/sovepose",
    placement: "guide_table", retailer: "backpackerlife", category: "sovepose",
    price_dkk: 599, product_name: "Sovepose X", brand: "Treklife", ...over,
  };
}
function ev(event: string, created_at: string): EventRaekke {
  return { created_at, event, path: "/danmark/x", params: null };
}

describe("dkDato", () => {
  it("regner dagen i dansk tid, ikke i UTC", () => {
    // Om sommeren er Danmark UTC+2. Et klik 22:30 UTC er altså 00:30 dansk
    // tid NÆSTE dag. Grupperede vi på UTC-datoen, lå klikket på gårsdagen,
    // og grafen kunne ikke sammenlignes med noget brugeren selv kan tælle.
    expect(dkDato("2026-07-15T22:30:00Z")).toBe("2026-07-16");
    expect(dkDato("2026-07-15T21:30:00Z")).toBe("2026-07-15");
  });

  it("håndterer vintertid, hvor forskydningen kun er én time", () => {
    expect(dkDato("2026-01-15T23:30:00Z")).toBe("2026-01-16");
    expect(dkDato("2026-01-15T22:30:00Z")).toBe("2026-01-15");
  });
});

describe("dkUgedag", () => {
  it("lader ugen starte om mandagen", () => {
    // 2026-10-12 er en mandag. Søndag-først ville forskyde hele varmekortet.
    expect(dkUgedag("2026-10-12T12:00:00Z")).toBe(0);
    expect(dkUgedag("2026-10-18T12:00:00Z")).toBe(6);
  });
});

describe("dagligSerie", () => {
  it("giver én række pr. dag, også for dage uden aktivitet", () => {
    // Uden tomme dage komprimeres en stille weekend til ingenting, og en
    // flad uge ser ud som vækst.
    const s = dagligSerie([klik()], [], NU, 7);
    expect(s).toHaveLength(7);
    expect(s[6].dato).toBe("2026-10-11");
    expect(s[0].dato).toBe("2026-10-05");
    expect(s.filter((d) => d.klik === 0)).toHaveLength(6);
  });

  it("lægger pris sammen til dagens værdi", () => {
    const s = dagligSerie([klik({ price_dkk: 100 }), klik({ price_dkk: 250 })], [], NU, 3);
    expect(s[2].vaerdi).toBe(350);
  });

  it("tæller en pris på null som nul og ikke som NaN", () => {
    const s = dagligSerie([klik({ price_dkk: null })], [], NU, 2);
    expect(s[1].vaerdi).toBe(0);
    expect(s[1].klik).toBe(1);
  });

  it("fordeler events på hver sin tæller", () => {
    const s = dagligSerie([], [
      ev("gear_block_seen", "2026-10-11T08:00:00Z"),
      ev("gear_block_seen", "2026-10-11T09:00:00Z"),
      ev("gear_suggestion_click", "2026-10-11T09:05:00Z"),
      ev("guide_view", "2026-10-11T09:06:00Z"),
      ev("book_button_clicked", "2026-10-11T09:07:00Z"),
      ev("et_ukendt_event", "2026-10-11T09:08:00Z"),
    ], NU, 2);
    expect(s[1]).toMatchObject({
      grejVisninger: 2, grejKlik: 1, guideVisninger: 1, bookingKlik: 1,
    });
  });

  it("ignorerer rækker uden for vinduet", () => {
    const s = dagligSerie([klik({ created_at: "2026-01-01T10:00:00Z" })], [], NU, 7);
    expect(s.reduce((a, d) => a + d.klik, 0)).toBe(0);
  });
});

describe("glidende", () => {
  it("bruger kun de dage der findes, i starten af serien", () => {
    // Et 7-dages gennemsnit der dividerer med 7 fra dag 1 starter kunstigt
    // lavt og tegner en opadgående trend der ikke findes.
    expect(glidende([6, 6, 6], 7)).toEqual([6, 6, 6]);
  });

  it("glider over vinduet", () => {
    expect(glidende([0, 0, 3], 3)).toEqual([0, 0, 1]);
  });
});

describe("guideSlug", () => {
  it("ser igennem query-parametre", () => {
    expect(guideSlug("/bedste/sovepose?utm_source=chatgpt.com")).toBe("sovepose");
  });
  it("tåler en afsluttende skråstreg", () => {
    expect(guideSlug("/bedste/sovepose/")).toBe("sovepose");
  });
  it("giver null for alt der ikke er en guide-side", () => {
    expect(guideSlug("/danmark/jylland/x")).toBeNull();
    expect(guideSlug("/bedste")).toBeNull();
    expect(guideSlug("/bedste/a/b")).toBeNull();
    expect(guideSlug(null)).toBeNull();
  });
});

describe("grupper", () => {
  it("samler null-nøgler under (ingen) i stedet for at smide dem væk", () => {
    // At 30 klik mangler forhandler er i sig selv noget man skal kunne se.
    const b = grupper([klik({ retailer: null }), klik()], (k) => k.retailer, NU, 7);
    expect(b.map((x) => x.navn).sort()).toEqual(["(ingen)", "backpackerlife"]);
    expect(b.reduce((s, x) => s + x.klik, 0)).toBe(2);
  });

  it("skiller de seneste 7 dage fra de 7 før dem", () => {
    const b = grupper([
      klik({ created_at: "2026-10-10T10:00:00Z" }),   // inden for 7 dage
      klik({ created_at: "2026-10-01T10:00:00Z" }),   // 7-14 dage siden
      klik({ created_at: "2026-09-01T10:00:00Z" }),   // ældre end 14 dage
    ], () => "x", NU, 90);
    expect(b[0].nu7).toBe(1);
    expect(b[0].foer7).toBe(1);
    expect(b[0].klik).toBe(3);
  });

  it("giver andele der summer til 1", () => {
    const b = grupper([klik(), klik({ retailer: "outmore" })], (k) => k.retailer, NU, 7);
    expect(b.reduce((s, x) => s + x.andel, 0)).toBeCloseTo(1);
  });

  it("giver en serie der er lige så lang som vinduet", () => {
    const b = grupper([klik()], (k) => k.retailer, NU, 30);
    expect(b[0].serie).toHaveLength(30);
    expect(b[0].serie[29]).toBe(1);
  });

  it("sorterer efter klik og derefter alfabetisk, så rækkefølgen er stabil", () => {
    const b = grupper([klik({ retailer: "zeta" }), klik({ retailer: "alfa" })],
      (k) => k.retailer, NU, 7);
    expect(b.map((x) => x.navn)).toEqual(["alfa", "zeta"]);
  });
});

describe("noegletal", () => {
  it("sammenligner perioden med den foregående af samme længde", () => {
    const n = noegletal([
      klik({ created_at: "2026-10-10T10:00:00Z" }),
      // NU er 11/10, så det aktuelle vindue starter 13/9 og det forrige 16/8.
      klik({ created_at: "2026-09-01T10:00:00Z" }),  // forrige 28-dages vindue
      klik({ created_at: "2026-07-01T10:00:00Z" }),  // før begge: tæller ikke
    ], [], NU, 28);
    expect(n.klik).toBe(1);
    expect(n.klikForrige).toBe(1);
  });

  it("regner median og ikke gennemsnit, så én dyr vare ikke flytter tallet", () => {
    const n = noegletal(
      [100, 200, 300, 400, 20000].map((p) => klik({ price_dkk: p })), [], NU, 28);
    expect(n.medianPris).toBe(300);
  });

  it("melder grejRate som null når blokken ikke er set, ikke som nul", () => {
    // 0 % og "ikke målt" er forskellige svar: det første er et problem, det
    // andet er manglende data.
    expect(noegletal([], [], NU, 28).grejRate).toBeNull();
    expect(noegletal([], [ev("gear_block_seen", "2026-10-11T08:00:00Z")], NU, 28).grejRate).toBe(0);
  });

  it("regner andelen af klik der kom fra en købsguide", () => {
    const n = noegletal([klik(), klik({ path: "/koeb-shelter" })], [], NU, 28);
    expect(n.andelFraGuider).toBe(0.5);
    expect(n.guiderMedKlik).toBe(1);
  });

  it("tåler et tomt datasæt", () => {
    const n = noegletal([], [], NU, 28);
    expect(n).toMatchObject({ klik: 0, vaerdi: 0, medianPris: null, andelFraGuider: 0 });
  });
});

describe("topProdukter", () => {
  it("samler på varenavn og sorterer efter klik", () => {
    const p = topProdukter([
      klik({ product_name: "A" }), klik({ product_name: "A" }), klik({ product_name: "B" }),
    ]);
    expect(p[0]).toMatchObject({ navn: "A", klik: 2 });
    expect(p[1]).toMatchObject({ navn: "B", klik: 1 });
  });
  it("respekterer loftet", () => {
    const mange = Array.from({ length: 40 }, (_, i) => klik({ product_name: `V${i}` }));
    expect(topProdukter(mange, 25)).toHaveLength(25);
  });
});

describe("varmekort", () => {
  it("lægger klikket i den rigtige celle i dansk tid", () => {
    // 2026-10-12 er mandag; 06:00 UTC er 08:00 dansk tid (sommertid).
    const g = varmekort([klik({ created_at: "2026-10-12T06:00:00Z" })]);
    expect(g[0][8]).toBe(1);
    expect(g.flat().reduce((a, b) => a + b, 0)).toBe(1);
  });
  it("har syv rækker og 24 kolonner, også uden data", () => {
    const g = varmekort([]);
    expect(g).toHaveLength(7);
    expect(g[0]).toHaveLength(24);
  });
});

describe("prisfordeling", () => {
  it("lægger hver pris i præcis ét trin", () => {
    const f = prisfordeling([50, 100, 999, 1000, 5000].map((p) => klik({ price_dkk: p })));
    expect(f.reduce((s, t) => s + t.antal, 0)).toBe(5);
    expect(f[0]).toMatchObject({ fra: 0, antal: 1 });      // 50
    expect(f[4]).toMatchObject({ fra: 1000, antal: 1 });   // 1000
    expect(f[5]).toMatchObject({ fra: 2000, antal: 1 });   // 5000
  });
  it("udelader varer uden pris frem for at kalde dem gratis", () => {
    const f = prisfordeling([klik({ price_dkk: null })]);
    expect(f.reduce((s, t) => s + t.antal, 0)).toBe(0);
  });
});

describe("grupper — vinduets grænse", () => {
  it("tæller ikke rækker der ligger før grafvinduet", () => {
    // Route-handleren henter bredere end grafvinduet, så retningspilene har
    // to perioder. Uden filteret talte tabellen de ekstra dage med, mens
    // overskriften lovede "de seneste N dage".
    const b = grupper([
      klik({ created_at: "2026-10-11T10:00:00Z" }),   // i vinduet
      klik({ created_at: "2026-10-03T10:00:00Z" }),   // 8 dage siden: udenfor
    ], () => "x", NU, 7);
    expect(b[0].klik).toBe(1);
  });

  it("regner andelen af de rækker der er med, ikke af alle hentede", () => {
    const b = grupper([
      klik({ created_at: "2026-10-11T10:00:00Z", retailer: "a" }),
      klik({ created_at: "2026-10-03T10:00:00Z", retailer: "b" }),
    ], (k) => k.retailer, NU, 7);
    expect(b).toHaveLength(1);
    expect(b[0].andel).toBe(1);
  });
});

describe("kronebeløb", () => {
  it("afrunder, så summen ikke bærer en flydende-komma-rest", () => {
    // Feedets priser har ører (243,1 kr.), og 0,1 kan ikke repræsenteres
    // præcist. Uden afrunding stod der 196.203,50000000006 i API-svaret.
    const øre = [243.1, 814.95, 362.95].map((p) => klik({ price_dkk: p }));
    expect(noegletal(øre, [], NU, 28).vaerdi).toBe(1421);
    expect(grupper(øre, () => "x", NU, 7)[0].vaerdi).toBe(1421);
    expect(dagligSerie(øre, [], NU, 2)[1].vaerdi).toBe(1421);
  });
});
