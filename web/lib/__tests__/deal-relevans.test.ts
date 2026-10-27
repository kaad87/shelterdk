import { describe, expect, it } from "vitest";
import {
  delerEmneord,
  emneOrd,
  erTilbehoer,
  fjernStoej,
  erStoej,
  fold,
  kategoriErEget,
  relevanteTilbud,
  varianthoved,
  dubletNoegle,
  type GuideKontekst,
} from "../deal-relevans";

/**
 * Proeverne er de varer, blokken faktisk viste 26. oktober 2026, og de varer
 * de 182 historiske klik ramte. Testen falder derfor baade hvis et maalt
 * irrelevant tilfaelde kommer tilbage, og hvis et maalt klik ville blive
 * filtreret vaek.
 */
const v = (
  product_name: string,
  category_mapped: string | null = null,
  brand: string | null = null,
  id = product_name
) => ({ id, brand, product_name, category_mapped });

const g = (
  slug: string,
  kategori: string,
  entryNavne: string[],
  entryMaerker: string[] = []
): GuideKontekst => ({ slug, kategori, entryNavne, entryMaerker });

describe("fold", () => {
  it("folder de danske bogstaver og deres digrafer ens", () => {
    expect(fold("oekse")).toBe(fold("Økse"));
    expect(fold("rygsaek")).toBe(fold("Rygsæk"));
    expect(fold("haandklaede")).toBe("handklade");
    expect(fold("taendstaal")).toBe(fold("Tændstål"));
  });

  it("fjerner skilletegn, saa ordgraenser ikke kan snyde", () => {
    expect(fold("dry-bag")).toBe("drybag");
  });
});

describe("erTilbehoer", () => {
  it("fanger det tilbehoer blokken viste", () => {
    expect(erTilbehoer("Celestron Lens Cleaning Kit - Tilbehør til kikkerter")).toBe(true);
    expect(erTilbehoer("Jaeger Staalmontager 30 mm Medium")).toBe(true);
    expect(erTilbehoer("Celestron HAND CONTROL AZ")).toBe(true);
    expect(erTilbehoer("LifeStraw Flex Replacement Carbon Filter - Vandfilter")).toBe(true);
    expect(erTilbehoer("Ricoh/Pentax Pentax Tripod Adapter U")).toBe(true);
  });

  it("lader varen selv passere", () => {
    expect(erTilbehoer("LifeStraw Flex Vandfilter")).toBe(false);
    expect(erTilbehoer("Kikkert - Nikon Prostaff P3 8x42")).toBe(false);
    expect(erTilbehoer("Økse - Fiskars X7")).toBe(false);
    expect(erTilbehoer("Sea To Summit Air Chair Large Black/grey - Stol")).toBe(false);
  });

  it("laeser ikke 'SovePOSE TIL boern' som en pose til noget", () => {
    // `pose\s+til` stod uden ordgraense, saa hver vare der hed "Sovepose til
    // X" blev regnet som tilbehoer. Maalt mod 984 historiske klik paa
    // /bedste-sider faldt 9 paa netop det, heraf otte produkter som
    // /bedste/sovepose-til-boern selv handler om.
    expect(erTilbehoer("Sovepose til børn - Treklife Junior - 4 sæsons")).toBe(false);
    expect(erTilbehoer("Sovepose til vinter - Treklife Peak 4S - 4 sæsons")).toBe(false);
    expect(erTilbehoer("Lagenpose til sovepose - Sea to Summit")).toBe(false);
    // Og den fanger stadig en rigtig pose til noget.
    expect(erTilbehoer("Pose til telt - opbevaringspose")).toBe(true);
    expect(erTilbehoer("Taske til kikkert - Nikon")).toBe(true);
  });
});

describe("varianthoved", () => {
  it("folder stoerrelser skrevet med mellemrum", () => {
    // basisNavn er forankret paa komma og bindestreg og giver disse uaendret
    // tilbage; det var derfor to af tre tilbud paa fleece var samme troeje.
    expect(varianthoved("Pinewood Tiveden Sweater Fleece W Black S")).toBe(
      varianthoved("Pinewood Tiveden Sweater Fleece W Black M")
    );
    expect(varianthoved("Trespass Bernia Adventure Vandrebukser Women Black M")).toBe(
      varianthoved("Trespass Bernia Adventure Vandrebukser Women Black XXL")
    );
  });

  it("folder en afsluttende farve", () => {
    expect(varianthoved("Knog Bilby Run 400 Coral")).toBe(varianthoved("Knog Bilby Run 400 Lime"));
  });

  it("lader modellen staa naar sidste ord ikke er stoerrelse eller farve", () => {
    expect(varianthoved("Teva Verra Dame")).toBe("Teva Verra Dame");
    expect(varianthoved("Trangia 25-1 Stormkøkken UL")).toBe("Trangia 25-1 Stormkøkken UL");
  });
});

describe("emneOrd", () => {
  it("udelader maerket, saa vokabularet er et emnefilter og ikke et maerkefilter", () => {
    const ord = emneOrd("Sea to Summit Camp Cutlery Set", ["Sea to Summit"]);
    expect([...ord]).not.toContain("summit");
    expect([...ord]).toContain("cutlery");
  });

  it("udelader for korte ord og rene tal", () => {
    const ord = emneOrd("Dry Bag 10 L - Sea to Summit", ["Sea to Summit"]);
    expect([...ord]).not.toContain("bag");
    expect([...ord]).not.toContain("10");
  });
});

describe("delerEmneord", () => {
  it("matcher en dansk flertalsform via praefiks", () => {
    expect(delerEmneord(new Set(["kikkerter"]), new Set(["kikkert"]))).toBe(true);
  });

  it("matcher ikke paa et kort praefiks", () => {
    // "camp" maa ikke matche "camping", ellers slap Camping Pot ind paa bestik.
    expect(delerEmneord(new Set(["camping"]), new Set(["camp"]))).toBe(false);
  });
});

describe("kategoriErEget", () => {
  it("regner en snaevrere variant af guiden som samme emne", () => {
    expect(kategoriErEget("telt", "telt")).toBe(true);
    expect(kategoriErEget("letvaegtstelt", "telt")).toBe(true);
    expect(kategoriErEget("liggeunderlag-til-vinter", "liggeunderlag")).toBe(true);
    expect(kategoriErEget("dunsovepose", "sovepose")).toBe(true);
    expect(kategoriErEget("vandrerygsaek", "rygsaek")).toBe(true);
  });

  it("skelner naboer fra samme emne", () => {
    expect(kategoriErEget("lanterne", "pandelampe")).toBe(false);
    expect(kategoriErEget("oekse", "kniv")).toBe(false);
    expect(kategoriErEget("kompas", "prepping")).toBe(false);
    expect(kategoriErEget("handsker", "beklædning")).toBe(false);
    expect(kategoriErEget("campingstol", "campingmobler")).toBe(false);
  });
});

describe("relevanteTilbud: de maalte irrelevante tilbud", () => {
  it("fjerner cykelsaettet fra de fire beklaednings-guider", () => {
    const varer = [v("Gentlemen's Hardware - Bicycle Repair Kit", "beklædning")];
    const guider: GuideKontekst[] = [
      g("handsker", "beklædning", [
        "Handsker - Hestra Fält Guide",
        "Handsker - Treklife Fleece",
        "Handsker - Devold Nansen",
      ]),
      g("hue", "beklædning", ["Hue - Devold Nansen", "Hue - Treklife Fleece", "Hue - Buff Merino"]),
      g("gamacher", "beklædning", [
        "Gaiters - Highlander Walking",
        "Gaiters - Montane Alta Gaiter",
        "Gaiters - Montane Cetus Gaiter",
      ]),
      g("uldundertoj", "beklædning", [
        "Uldundertøj - Devold Duo Active",
        "Uldundertøj - Aclima WarmWool",
        "Uldundertøj - Icebreaker 200",
      ]),
    ];
    for (const guide of guider) expect(relevanteTilbud(varer, guide)).toEqual([]);
  });

  it("fjerner proptraekkeren fra oekse-guiden", () => {
    const guide = g("oekse", "kniv", ["Økse - Fiskars X7", "Økse - Hultafors Classic"]);
    const varer = [
      v("COAST LED150 Pro Dual LED multitool", "kniv"),
      v("Point Virgule Tjenerkniv/proptrækker I Rustfri Stål - Multitool", "kniv"),
    ];
    expect(relevanteTilbud(varer, guide)).toEqual([]);
  });

  it("beholder en rigtig oekse naar guiden faktisk handler om oekser", () => {
    // Den rigtige /bedste/oekse havde 6 save af 8 entries, saa "okse" stod kun
    // i to og naaede ikke taersklen. Her er guiden som den skal se ud.
    const guide = g("oekse", "kniv", [
      "Økse - Black Paracord Axe - Stål",
      "Helko Werk Black Forest Pack Økse",
      "Økse - Fiskars X7",
      "Økse - Hultafors Classic",
    ]);
    expect(relevanteTilbud([v("Økse - Gränsfors Bruk Small Forest", "kniv")], guide)).toHaveLength(1);
  });

  it("fjerner noedpakker fra kompas og madkasser fra taendstaal", () => {
    expect(
      relevanteTilbud([v("Nødpakke - Large", "prepping")], g("kompas", "prepping", ["Kompas - Silva Ranger"]))
    ).toEqual([]);
    expect(
      relevanteTilbud(
        [v("Sistema Meal Prep 5-pack 870 Ml", "kogeudstyr")],
        g("taendstaal", "kogeudstyr", ["Tændstål - Light My Fire Army"])
      )
    ).toEqual([]);
  });

  it("fjerner Camping Pot fra bestik, selv om en entry hedder Camp Cutlery", () => {
    const guide = g(
      "bestik",
      "kogeudstyr",
      ["Spork - Sea to Summit Camp Cutlery Spork", "Bestiksæt - Sea to Summit Passage Cutlery Set"],
      ["Sea to Summit"]
    );
    const varer = [
      v("Gentlemen's Hardware Camping Pot - Gryde", "kogeudstyr"),
      v("Trangia 25-1 Stormkøkken UL", "kogeudstyr"),
    ];
    expect(relevanteTilbud(varer, guide)).toEqual([]);
  });

  it("beholder stormkoekkenet paa stormkoekken-guiden", () => {
    // Samme brede kategori som taendstaal, men "stormkokken" kendetegner guiden.
    const guide = g(
      "stormkoekken",
      "kogeudstyr",
      [
        "Stormkøkken - Trangia 27-1 UL",
        "Stormkøkken - Trangia 25-1 HA",
        "Stormkøkken - Primus Lite Plus",
        "Gasbrænder - Primus Classic Trail",
      ],
      ["Trangia", "Primus"]
    );
    expect(relevanteTilbud([v("Trangia 25-1 Stormkøkken UL", "kogeudstyr")], guide)).toHaveLength(1);
  });

  it("fjerner boernemadkassen fra dry-bag", () => {
    const guide = g("dry-bag", "taske", ["Dry bag - Sea to Summit Lightweight 8L"], ["Sea to Summit"]);
    const varer = [
      v("Fluf Zipper Lunch Bag - Shark", "taske"),
      v("Gentlemen's Hardware Travel Tech Case - Cover", "taske"),
    ];
    expect(relevanteTilbud(varer, guide)).toEqual([]);
  });

  it("fjerner tilbehoer selv i den rigtige kategori", () => {
    const guide = g("kikkert", "kikkert", ["Kikkert - Nikon Prostaff P3 8x42"], ["Nikon"]);
    const varer = [
      v("Jaeger Staalmontager 30 mm Medium - Tilbehør til kikkerter", "kikkert"),
      v("Celestron HAND CONTROL AZ - Tilbehør til kikkerter", "kikkert"),
      v("Kikkert - Bresser Hunter 8x40", "kikkert"),
    ];
    expect(relevanteTilbud(varer, guide).map((x) => x.product_name)).toEqual([
      "Kikkert - Bresser Hunter 8x40",
    ]);
  });

  it("fjerner pandelamper fra lanterne-guiden", () => {
    const guide = g("lanterne", "pandelampe", ["Lanterne - Goal Zero Lighthouse"], ["Goal Zero"]);
    expect(relevanteTilbud([v("Knog Bilby Run 400 Coral - Pandelampe", "pandelampe")], guide)).toEqual([]);
  });
});

describe("relevanteTilbud: de maalte klik maa ikke forsvinde", () => {
  it("beholder Air Chair paa campingstol, hvor slug og kategori ikke matcher", () => {
    // 5 klik. campingstol -> campingmobler, og navnet siger "Chair", ikke
    // "campingstol". Entry-ordet "stol" er det der baerer relevansen.
    const guide = g(
      "campingstol",
      "campingmobler",
      [
        "Stol - Treklife High-back UL Chair",
        "Stol - Treklife Low-back UL Chair",
        "Stol - Treklife Luxe Chair",
        "Stol - Nemo Moonlite Reclining Camp Chair",
        "Campingstol - Positionsstol med 5 indstillinger",
        "Festivalstol - 2 kopholdere - Ekstra robust model - Brun",
        "Foldestol - dobbelt - Sort",
      ],
      ["Treklife", "Nemo"]
    );
    const varer = [v("Sea To Summit Air Chair Large Black/grey - Stol", "campingmobler")];
    expect(relevanteTilbud(varer, guide)).toHaveLength(1);
  });

  it("beholder Tatonka-rygsaekken paa vandrerygsaek", () => {
    // 5 klik.
    const guide = g("vandrerygsaek", "rygsaek", ["Rygsæk - Osprey Talon 33"], ["Osprey"]);
    const varer = [v("Rygsæk til kvinde - Tatonka Yukon 60 + 10 liter", "rygsaek")];
    expect(relevanteTilbud(varer, guide)).toHaveLength(1);
  });

  it("beholder engelsksprogede gaiters paa gamacher", () => {
    // 4 klik. Navnet er engelsk, slug'en dansk.
    const guide = g(
      "gamacher",
      "beklædning",
      [
        "Gaiters - Highlander Walking",
        "Gaiters - Montane Alta Gaiter",
        "Gaiters - Montane Cetus Gaiter",
        "Vaude Albona Gaiter Ii - Anthracite - Gaiter",
      ],
      ["Montane", "Vaude", "Highlander"]
    );
    const varer = [v("Gaiters - Black Diamond Frontpoint GTX V2 - Sort", "beklædning")];
    expect(relevanteTilbud(varer, guide)).toHaveLength(1);
  });

  it("beholder boernesoveposer paa boerneguiden, men ikke paa vinterguiden", () => {
    // 3 klik laa paa /bedste/sovepose-til-boern. ALDRIG maa ikke fjerne det,
    // guiden handler om.
    const boern = g("sovepose-til-boern", "sovepose", ["Børnesovepose - Treklife Trip 3 Junior"]);
    const vinter = g("sovepose-til-vinter", "sovepose", ["Sovepose - Snugpak Softie 12"]);
    const vare = [v("Børnesovepose - Snugpak Sleeper Kids", "sovepose")];
    expect(relevanteTilbud(vare, boern)).toHaveLength(1);
    expect(relevanteTilbud(vare, vinter)).toEqual([]);
  });

  it("beholder en fleece der ikke hedder fleece, fordi kategorien er guidens egen", () => {
    const guide = g("fleece", "fleece", ["Fleecetrøje - Aclima ReBorn"], ["Aclima"]);
    const varer = [v("Helly Hansen Womens Imperial Long Pile Jacket 2.0", "fleece", "Helly Hansen")];
    expect(relevanteTilbud(varer, guide)).toHaveLength(1);
  });
});

describe("relevanteTilbud: dubletter og raekkefoelge", () => {
  it("viser kun én variant af samme model", () => {
    const guide = g("fleece", "fleece", ["Fleecetrøje - Aclima ReBorn"], ["Aclima"]);
    const varer = [
      v("Pinewood Tiveden Sweater Fleece W Black S", "fleece", "Pinewood", "a"),
      v("Pinewood Tiveden Sweater Fleece W Black M", "fleece", "Pinewood", "b"),
      v("Berghaus Womens Kinetic Powerstretch Hoody", "fleece", "Berghaus", "c"),
    ];
    expect(relevanteTilbud(varer, guide).map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("bevarer raekkefoelgen, saa stoerste rabat stadig staar foerst", () => {
    const guide = g("vandresandal", "vandresandal", ["Vandresandal - Teva Terra"], ["Teva"]);
    const varer = [
      v("Vandresandal - Keen Newport", "vandresandal", "Keen", "1"),
      v("Vandresandal - Merrell Terran", "vandresandal", "Merrell", "2"),
    ];
    expect(relevanteTilbud(varer, guide).map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("returnerer tom liste frem for noget forkert", () => {
    expect(relevanteTilbud([], g("oekse", "oekse", ["Økse - Fiskars"]))).toEqual([]);
  });
});

describe("dubletNoegle", () => {
  it("folder en variant der staar midt i navnet", () => {
    // Outmore saetter kategorien sidst, saa farven staar i midten og
    // varianthoved alene kan ikke se den.
    expect(dubletNoegle("Knog Bilby Run 400 Coral - Pandelampe")).toBe(
      dubletNoegle("Knog Bilby Run 400 Lime - Pandelampe")
    );
  });

  it("holder to forskellige modeller adskilt", () => {
    expect(dubletNoegle("Knog Bilby Run 400 - Pandelampe")).not.toBe(
      dubletNoegle("Knog Bilby Silikone Genopladelig - Pandelampe")
    );
  });
});

describe("relevanteTilbud: engros", () => {
  it("fjerner en aeske med 100 gummihandsker fra handske-guiden", () => {
    // outmore::Handsker er kortlagt til handsker, saa varen naar aldrig
    // navnereglerne. Vaernet skal derfor ogsaa staa her.
    const guide = g("handsker", "handsker", [
      "Handsker - Hestra Fält Guide",
      "Handsker - Sealskinz Solo Merino",
      "Handsker - Black Diamond Mont Blanc",
    ]);
    const varer = [v("Park Tool Parktool Gummihandske Mg-3 L Box Med 100 - Handsker", "handsker")];
    expect(relevanteTilbud(varer, guide)).toEqual([]);
  });
});

describe("relevanteTilbud: én boernevare slukker ikke vaernet", () => {
  it("fjerner en boerneponcho fra regntoej-guiden, der har én bevidst boernevare", () => {
    // Maalt live: /bedste/regntoj viste "Reisenthel Mini Maxi Poncho M Kids
    // Abc Friends Blue", fordi guiden har én bevidst boerne-poncho ud af syv
    // entries og vaernet spurgte om NOGEN af dem var en boernevare.
    const guide = g("regntoj", "regntoj", [
      "Regnjakke - Treklife Rain",
      "Regnsæt herre - Treklife Rain Packaway",
      "Regnbukser - Highlander Stow & Go",
      "Coghlans Poncho For Kids - Poncho",
      "Regnjakke dame - Trespass Nasu",
      "Regnslag - Treklife",
      "Poncho - Easy Camp",
    ]);
    const varer = [v("Reisenthel Mini Maxi Poncho M Kids Abc Friends Blue", "regntoj")];
    expect(relevanteTilbud(varer, guide)).toEqual([]);
  });

  it("beholder stadig boernevarer paa en guide der handler om boern", () => {
    const guide = g("sovepose-til-boern", "sovepose", [
      "Børnesovepose - Treklife Trip 3 Junior",
      "Sovepose til børn - Snugpak Sleeper Kids",
      "Børnesovepose - Highlander Creature",
    ]);
    expect(relevanteTilbud([v("Børnesovepose - Vango Nitestar", "sovepose")], guide)).toHaveLength(1);
  });
});

describe("fjernStoej", () => {
  const v = (id: string, brand: string | null, navn: string) =>
    ({ id, brand, product_name: navn, category_mapped: null });

  it("folder farve- og stoerrelsesvarianter af samme vare sammen", () => {
    // Tre varianter af den samme troeje stod som tre tilbud paa fleece.
    const ud = fjernStoej([
      v("1", "Pinewood", "Pinewood Tiveden Sweater Fleece W Black S"),
      v("2", "Pinewood", "Pinewood Tiveden Sweater Fleece W Black M"),
      v("3", "Pinewood", "Pinewood Tiveden Sweater Fleece W Black L"),
    ]);
    expect(ud.map((x) => x.id)).toEqual(["1"]);
  });

  it("folder ikke to varer fra samme serie i forskelligt materiale sammen", () => {
    const ud = fjernStoej([
      v("1", "Treklife", "Sovepose - Treklife Peak 4S - 4 sæsons"),
      v("2", "Treklife", "Dunsovepose - Treklife Down 900 - 4 sæsons"),
    ]);
    expect(ud).toHaveLength(2);
  });

  it("fjerner tilbehoer og engros", () => {
    const ud = fjernStoej([
      v("1", "Celestron", "Celestron Lens Cleaning Kit - Tilbehør til kikkerter"),
      v("2", "Park Tool", "Park Tool Gummihandske Mg-3 L Box Med 100"),
      v("3", "Fiskars", "Økse - Fiskars X7"),
    ]);
    expect(ud.map((x) => x.id)).toEqual(["3"]);
  });

  it("beholder to forskellige varer fra samme maerke", () => {
    const ud = fjernStoej([
      v("1", "Sea to Summit", "Dry bag - Sea to Summit Ultra-Sil - 8 liter"),
      v("2", "Sea to Summit", "Sovepude - Sea to Summit Aeros Premium - Large"),
    ]);
    expect(ud).toHaveLength(2);
  });
});

describe("erStoej: varer der ikke er friluftsgrej", () => {
  it("fanger proptraekkere, ogsaa naar kategorien er rigtig", () => {
    // outmore::Multitool er kortlagt til `kniv`, og grenen rummer baade
    // Gerber og Victorinox OG tre Point Virgule-proptraekkere. Raekken kan
    // ikke afgoere det, saa visningen maa.
    expect(erStoej("Point Virgule Tjenerkniv/proptrækker I Rustfri Stål - Multitool")).toBe(true);
    expect(erStoej("Gentlemen's Hardware Tools Corkscrew - Multitool")).toBe(true);
  });
  it("lader rigtige multitools og knive passere", () => {
    expect(erStoej("Gerber Dime Multi-tool, Red, Gb - Multitool")).toBe(false);
    expect(erStoej("Victorinox Pocket Tool Sentinel, black, one hand knife")).toBe(false);
    expect(erStoej("Morakniv Companion - Kniv")).toBe(false);
    expect(erStoej("COAST LED150 Pro Dual LED multitool")).toBe(false);
  });
});

describe("erStoej: batterier er ikke pandelamper", () => {
  // Alle navne herunder er hentet raat fra feedet. Sytten varer paa lager var
  // kortlagt til `pandelampe` og havde "batteri" eller "battery" i navnet,
  // men kun fire af dem var lamper. De tretten andre var loese batterier og
  // batteriaesker.
  //
  // De var IKKE synlige: ingen af de tretten naaede 25 %, og baade /tilbud og
  // tilbudsblokkene i guiderne kraever det. Det goer dem ikke harmloese.
  // /black-friday har en flydende graense: den fylder pladserne oppefra og
  // oplyser bagefter, hvad den laveste rabat blev. Er puljen tynd, eller
  // saetter Silva sine reservebatterier 30 % ned i november, staar de paa
  // siden. Reglen er altsaa forebyggende, og det er den rigtige maade at
  // sige det paa.
  it("fjerner loese batterier og batteriaesker", () => {
    expect(erStoej("Genopladeligt batteri til pandelampe - Petzl Core")).toBe(true);
    expect(erStoej("Batteri til pandelampe - Black Diamond LT")).toBe(true);
    expect(erStoej("Batteri - Black Diamond Distance")).toBe(true);
    expect(erStoej("Silva Free Headlamp Battery 14.4wh (2.0ah) - Batteri")).toBe(true);
    expect(erStoej("Silva Free Battery Case 3xaaa - Batteriæske")).toBe(true);
    expect(erStoej("Suprabeam Batterikasse (DC/DC) til V3pro rechargeable 1000 lm - Batteriæske")).toBe(true);
    expect(erStoej("Black Diamond Megawatt Headlamp Battery - Black One Size - Batteri")).toBe(true);
  });

  it("beholder lamper der blot naevner batteri", () => {
    // Den praecision er hele pointen. Et bredt /batteri|battery/ ville have
    // taget de her fire med, og to af dem er rigtige pandelamper.
    expect(erStoej("Pandelampe inkl. batterier - Sight LED")).toBe(false);
    expect(erStoej("Pandelampe inkl. batterier - Beam LED")).toBe(false);
    expect(
      erStoej(
        "COAST XPH25R Rechargeable Headlamp (410 lumens) with Battery indicator - in blister pack - Vending pack - Pandelampe"
      )
    ).toBe(false);
    expect(
      erStoej(
        "Armytek Crystal Wrb Blue / White Light & Red-blue Beacon / 150 Lm, 30 Lm & 17 Lm / Headband / Silicone Installation Rings / Built-in Li-pol Battery - Pandelampe"
      )
    ).toBe(false);
    expect(erStoej("PETZL ACTIK CORE Genopladelig Pandelampe - Blue")).toBe(false);
  });
});

describe("erStoej: madkasser og skivoks er ikke friluftsgrej", () => {
  it("fjerner madkasser og skiudstyr der er havnet i drikkedunk", () => {
    // Begge kom fra navnereglen: "Bottle" i navnet gjorde en voksskraber og
    // en madkasse til drikkedunke, og madkassen naaede /tilbud.
    expect(erStoej("Swix T30 Uni Scraper W/ Bottle Opener - Skiudstyr")).toBe(true);
    expect(erStoej("Sistema 1.1l Ribbon With 480ml Bottle Ocean Bound - Teal Stone - Madkasse")).toBe(true);
  });

  it("beholder rigtige drikkedunke, ogsaa fra et ski-brand", () => {
    expect(erStoej("Swix Insulated Drink Bottle - Swix red - Str. OS - Skiudstyr")).toBe(false);
    expect(erStoej("Drikkedunk - Nalgene Wide Mouth - 1 liter")).toBe(false);
  });
});
