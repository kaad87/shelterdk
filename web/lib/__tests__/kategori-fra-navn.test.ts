import { describe, expect, it } from "vitest";
import { kategoriFraNavn, sikkerKategoriFraNavn } from "../kategori-fra-navn";

/**
 * Proeverne er rigtige produktnavne fra kataloget, maalt 26. oktober 2026.
 * De positive er de varer, der laa i en guide uden kategori; de negative er
 * de fejl, en loesere udgave af reglerne lavede.
 */
describe("kategoriFraNavn: de 72 guide-entries der manglede en kategori", () => {
  const PROEVER: [string, string][] = [
    ["Telt - Treklife UV Block XL 4P - 4 personer", "telt"],
    ["3 personers xl telt - Pico 3.0 blackout", "telt"],
    ["Sovepose til børn - Trespass Bunka", "sovepose"],
    ["Dunsovepose - Treklife Down 600 - 4 sæsons", "sovepose"],
    ["Regnsæt herre - Treklife Rain Packaway - Sort", "regntoj"],
    ["Coghlans Poncho For Kids - Poncho", "regntoj"],
    ["Base layer unisex - Trespass Unite 360", "undertoj"],
    ["Uldunderbukser herre - Ulvang Rav - 100 % merino uld", "undertoj"],
    ["Montane F Dart Xt Long Janes - BLACK - Str. M/EU38-40 - Undertrøje", "undertoj"],
    ["Liggeunderlag - Treklife Extreme RV - Insulated", "liggeunderlag"],
    ["Siddeunderlag - Highlander Pak-Pad Air", "siddeunderlag"],
    ["Tatonka Alu-seat Mat 45 X 90cm - Silver - Siddepude", "siddeunderlag"],
    ["Vandrestøvler herre - ECCO Offroad Boot M - Sort", "fodtoj"],
    ["Vandresko til dame - Merrell Moab 3 GTX - Grå", "fodtoj"],
    ["Dry bag sæt - Medium - 3 stk - Sort", "taske"],
    ["Drikkedunk til børn - Nalgene Kids OTF - 350 ml", "drikkedunk"],
    ["Primus Classic Light Vacuum Bottle 0.5 L Summit - Termoflaske", "drikkedunk"],
    ["Optænding - SOL Tinder-Quik - 12 stk", "taendstaal"],
    ["Primus Ignition Steel Small Barn Red - Tændstål", "taendstaal"],
    ["Muurikka optændingsspåner - Båludstyr", "taendstaal"],
    ["Festivalstol - 2 kopholdere - Ekstra robust model - Brun", "campingmobler"],
    ["Stol - Nemo Moonlite Reclining Camp Chair", "campingmobler"],
    ["Gaiters til børn - Glenshee - Sort", "gamacher"],
    ["Vaude Albona Gaiter Ii - Anthracite - Str. M - Gaiter", "gamacher"],
    ["Pandelampe til børn  -  Black Diamond Wiz", "pandelampe"],
    ["Frysetørret mad  Thai ret med kylling og ris", "mad"],
    ["TravelSafe Mosquito Sun Hat med aftageligt myggenet", "myggenet"],
    ["Darn Tough Hiker Boot Sock Cushion Black L - Sokker - Str L", "sokker"],
    ["Sealskinz Solo Merino Glove - Black - Str. One Size - Handsker", "handsker"],
    ["Swix Heat Wool Beanie - Estate blue - Str. L/XL - Hue", "hue"],
    ["Montane Dart Xt Headband - BLACK - Str. ONE SIZE - Pandebånd", "hue"],
    ["Oppustelig hovedpude", "soveudstyr"],
    ["Powerbank 30.000 mAh - Hvid", "elektronik"],
    ["Hurtigtørrende microfiber håndklæde - 120 x 60 cm - Grå", "hygiejne"],
    ["Lanterne - Black Diamond Orbirter 450", "lygte"],
    ["Genopladelig lampe med lyskæde", "lygte"],
    ["Førstehjælpssæt - Kompakt - 31 dele", "foerstehjaelp"],
    ["Spork - Light My Fire Original BIO", "kogeudstyr"],
    ["Vandrestave - Black Diamond Trail Cork", "vandrestav"],
    ["Kikkert - Silva Binoculars Pocket 8X", "kikkert"],
  ];
  for (const [navn, kat] of PROEVER) {
    it(`${navn.slice(0, 46)} -> ${kat}`, () => {
      expect(kategoriFraNavn(navn)).toBe(kat);
    });
  }
});

describe("kategoriFraNavn: de fejl en loesere udgave lavede", () => {
  const FEJL: [string, string][] = [
    ["Pavillon Easy Up - 3x4,5m - Sekskantet stål - Navy", "en festpavillon er ikke et telt"],
    ["Sidevæg til pavillon 3m bredde - Dør - Grøn", "en sidevaeg er ikke et telt"],
    ["Park Tool Parktool Gummihandske Mg-3 L Box Med 100 - Handsker", "engros"],
    ["PRO Flaske 50 stk Transp. 800ml 50pcs bulk box - Drikkeflaske", "engros"],
    ["Light My Fire Tinder-on-a-Rope, 50g bulk", "engros"],
    ["Gift Republic Set Mug And Socks Fish - Krus", "gavesaet"],
    ["Vaude Bike Gaiter Short - Black - Str. 44-46 - Gaiter", "cykelgamache"],
    ["Vaude Shoecover Palade - Black - Str. 36-39 - Gaiter", "skoovertraek"],
    ["Lifeventure Thermarobe, Long Sleeved, Fleece Lined, - Jakke", "badekaabe"],
    ["Nikwax Nw Tech-wash - Neutral - Str. 5 l - Vaskemiddel", "toejvask"],
    ["Grangers Down Wash 300 Ml. - Vaskemiddel", "toejvask"],
    ["Grangers Rubber Boot Care 150 Ml. - Imprægnering", "plejemiddel"],
    ["Tatonka Rain Flap L - Cub - Str. Stk. - Regnslag", "regnslag til rygsaek"],
    ["Littlelife Buggy Parasol, Black - Paraply", "barnevognsparasol"],
    ["COAST LHS300 - lighted headband & safety light - Sikkerhedslys", "lys, ikke hue"],
    ["Trangia indsats til vindskærm 27/25", "reservedel"],
    ["Cargobag til rygsæk - Transportpose - Treklife", "tilbehoer til rygsaek"],
    ["Outdoor/shelter pakke - Essentials - Inkl rygsæk", "bundt"],
  ];
  for (const [navn, hvorfor] of FEJL) {
    it(`${navn.slice(0, 42)} -> null (${hvorfor})`, () => {
      expect(kategoriFraNavn(navn)).toBeNull();
    });
  }
});

describe("kategoriFraNavn: raekkefoelgen afgoer", () => {
  it("laegger pandelampen foer lygten", () => {
    expect(kategoriFraNavn("Pandelampe - Petzl Actik Core")).toBe("pandelampe");
  });
  it("laegger lagenposen foer soveposen", () => {
    expect(kategoriFraNavn("Cocoon Mummyliner, 100% Silk - Lagenpose")).toBe("soveudstyr");
  });
  it("laegger dunjakken foer fleecen", () => {
    expect(kategoriFraNavn("Montane Fem Resolute Down Jacket - BLACK - Jakke")).toBe("dunjakke");
  });
  it("laegger gamachen foer fodtoejet", () => {
    expect(kategoriFraNavn("Montane Trail Gaiter - BLACK - Str. L")).toBe("gamacher");
  });
  it("giver null for det der ikke er ShelterDK-udstyr", () => {
    expect(kategoriFraNavn("Shimano Bremseklods BR-M425")).toBeNull();
    expect(kategoriFraNavn("Kuffert - Samsonite Spinner 75")).toBeNull();
    expect(kategoriFraNavn("")).toBeNull();
  });
});

describe("kategoriFraNavn: sokker foer undertoej", () => {
  it("regner en merino-sok som sok og ikke som undertoej", () => {
    // "Crew" i merino-alternativet gjorde den til undertoej.
    expect(kategoriFraNavn("Vallerret Merino Wool Crew Sock - Grey Winter")).toBe("sokker");
  });
  it("regner en merino-undertroeje som undertoej", () => {
    expect(kategoriFraNavn("Ulvang Comfort 200 Turtle Neck W/zip Ws - Undertrøje")).toBe("undertoj");
    expect(kategoriFraNavn("Uldundertrøje herre - Ulvang Rav - 100% merino uld")).toBe("undertoj");
  });
});

describe("kategoriFraNavn: navne uden det danske typeord", () => {
  it("fanger engelske taendstikker", () => {
    expect(kategoriFraNavn("UCO Hurricane Match Kit")).toBe("taendstaal");
    expect(kategoriFraNavn("Hurricane Survival Matches")).toBe("taendstaal");
    expect(kategoriFraNavn("UCO Firestarting Kit")).toBe("taendstaal");
  });
  it("fanger flasker og kanistre", () => {
    expect(kategoriFraNavn("Hydrapak Stash Bottle 750 Ml")).toBe("drikkedunk");
    expect(kategoriFraNavn("Tatonka Faltkanister 5l - Stk.")).toBe("drikkedunk");
  });
  it("fanger et tysk siddeunderlag", () => {
    expect(kategoriFraNavn("Tatonka Alu-Sitzkissen")).toBe("siddeunderlag");
  });
  it("lader stadig cykelflasken og engros ligge", () => {
    expect(kategoriFraNavn("Elite Bottle FLY MTB TEX Black 950ml")).toBeNull();
    expect(kategoriFraNavn("PRO Flaske 50 stk Transp. 800ml 50pcs bulk box")).toBeNull();
  });
});

describe("kategoriFraNavn: plagget foer materialet", () => {
  it("regner en fleecehandske som handske", () => {
    // "Handsker - Fleece" blev fleece, fordi fleece-reglen stod foerst.
    expect(kategoriFraNavn("Handsker - Fleece")).toBe("handsker");
    expect(kategoriFraNavn("Handsker - Black Diamond Everyday Fleece - Sort")).toBe("handsker");
  });
  it("regner en fleecehue som hue", () => {
    expect(kategoriFraNavn("Hue - Fleece")).toBe("hue");
  });
  it("regner stadig en fleecetroeje som fleece", () => {
    expect(kategoriFraNavn("Fleecetrøje herre - Montane Roco Pull On - Grøn")).toBe("fleece");
  });
  it("lader maerket Buff vaere et maerke", () => {
    // "Buff Baseball Cap UPF50+" er solbeskyttelse, ikke en hue.
    expect(kategoriFraNavn("Buff Baseball Cap UPF50+")).not.toBe("hue");
  });
});

describe("kategoriFraNavn: tilbehoer og naboprodukter", () => {
  it("regner stavdele som tilbehoer og ikke som stave", () => {
    expect(kategoriFraNavn("Trekmates Trekking Pole Spare Basket - 52mm (Par)")).toBeNull();
    expect(kategoriFraNavn("Trekmates Trekking Pole Rubber Tip Ferrule Black")).toBeNull();
  });
  it("regner en lomme og et regnslag som andet end rygsaek", () => {
    expect(kategoriFraNavn("Tasmanian Tiger Tt Tac Pouch 10 - Black - Rygsæk")).toBeNull();
    expect(kategoriFraNavn("Tatonka Raincover Bike Daypack - Neonorange")).toBeNull();
  });
  it("regner et teleskop med GPS som kikkert og ikke navigation", () => {
    expect(kategoriFraNavn("Celestron CPC GPS XLT 800 - Kikkert")).toBe("kikkert");
  });
  it("regner et pandebaand til en pandelampe som andet end hue", () => {
    expect(kategoriFraNavn("Pandebånd til PETZL DUO og ULTRA")).not.toBe("hue");
    expect(kategoriFraNavn("PETZL PIXA RUBBER headband")).not.toBe("hue");
  });
  it("regner en halsedisse som andet end gamache", () => {
    expect(kategoriFraNavn("Halsedisse - Smartwool Thermal Long Neck Gaiter - Sort")).not.toBe("gamacher");
  });
  it("regner en filterflaske som vandfilter", () => {
    expect(kategoriFraNavn("Vandfilter - Katadyn Befree Filter 0.6 liter - Softflask")).toBe("vandfilter");
    expect(kategoriFraNavn("LifeStraw Peak Squeeze Bottle 1L - Dark Gray")).toBe("vandfilter");
  });
  it("regner stadig en almindelig flaske som drikkedunk", () => {
    expect(kategoriFraNavn("Hydrapak Stash Bottle 750 Ml")).toBe("drikkedunk");
    expect(kategoriFraNavn("Drikkeflaske - Termo vacuum - 1 liter")).toBe("drikkedunk");
  });
});

describe("kategoriFraNavn: modelnavne der ligner produkttyper", () => {
  it("regner en fotohandske ved navn Hatchet som handske", () => {
    expect(kategoriFraNavn("Vallerret Hatchet Leather Photography Glove Black XS")).toBe("handsker");
  });
  it("regner stadig en rigtig hatchet som oekse", () => {
    expect(kategoriFraNavn("Coghlans Hatchet - Økse")).toBe("oekse");
  });
  it("regner et klatrereb ved navn Flashlight som andet end lygte", () => {
    // Stod som `lygte` i kataloget. Samme fejl som fotohandsken.
    expect(kategoriFraNavn("Edelweiss Flashlight Ii 10mm60m - Reb")).toBeNull();
  });
  it("regner Primus' Campfire-serie som kogegrej og ikke baalgrej", () => {
    // "Campfire" er et produktlinjenavn hos Primus, ikke en beskrivelse.
    expect(kategoriFraNavn("Primus Campfire Cookset Small - Kogesæt")).toBe("kogeudstyr");
    expect(kategoriFraNavn("Bestiksæt - Primus Campfire Cutlery Set - 3 stk")).toBe("kogeudstyr");
    expect(kategoriFraNavn("Gentlemen's Hardware Campfire Chess - Spil")).toBeNull();
  });
});

describe("kategoriFraNavn: baaludstyr", () => {
  it("tager baalfade, grill, stoebejern, dutch oven og stativ", () => {
    for (const navn of [
      "Petromax Cast-iron Campfire Skillet - Båludstyr",
      "Winnerwell L-sized Flat Firepit - Bålsted",
      "Petromax Dutch Oven Ft4.5 - Båludstyr",
      "Hällmark Tripod With Bag - Black - Str. OneSize - Bålstativ",
      "Coghlans Pack Grill - Båludstyr",
      "UCO Sammenfoldelig Grill Flatpack Grill & Firepit",
      "Muurikka jægerpande t/bål i opbevaringsp - Båludstyr",
      "Petromax Campfire Bread Skewer With Cast-iron Tip - Båludstyr",
    ]) {
      expect(kategoriFraNavn(navn), navn).toBe("baaludstyr");
    }
  });

  it("lader reservedele og tilbehoer staa uden kategori", () => {
    // Petromax saelger systemet som enkeltdele, og delen navngiver sin vaert
    // paa engelsk. "X For Y" er graensen mellem en vare og en del til en vare.
    for (const navn of [
      "Petromax Lid For Pyron Fire Barrel - Båludstyr",
      "Petromax Transport Bag For Fire Bridge Frk1 - Båludstyr",
      "Petromax Cooking Support for Atago Gridd - Båludstyr",
      "Winnerwell Charcoal Grate For Xl-sized Flat Firepit - Båludstyr",
      "Biolite Firepit Carry Bag - Taske",
      "Biolite Firepit Poker - Båludstyr",
      "Petromax Tripod Lashing (large) - Båludstyr",
      "Petromax Atago Pizza Stone Pizzasten - Båludstyr",
    ]) {
      expect(kategoriFraNavn(navn), navn).toBeNull();
    }
  });

  it("staar foer kogeudstyr, saa en baalpande ikke bliver koekkengrej", () => {
    expect(kategoriFraNavn("Hällmark Griddle Pan 98 Cm - Black - Båludstyr")).toBe("baaludstyr");
    // Men en Trangia-pande er stadig kogegrej.
    expect(kategoriFraNavn("Pande - Trangia 25 - Nonstick")).toBe("kogeudstyr");
  });

  it("lader optaending blive taendstaal og ikke baaludstyr", () => {
    expect(kategoriFraNavn("Muurikka optændingsspåner - Båludstyr")).toBe("taendstaal");
    // "Campfire" staar i navnet, men varen er et taendstaal.
    expect(kategoriFraNavn("Easy Camp Campfire Fire Steel - Tændstål")).toBe("taendstaal");
  });
});

describe("kategoriFraNavn: kniv er ikke en vinaabner", () => {
  it("udelukker tjenerkniv og proptraekker", () => {
    // Tre varianter af denne stod som `kniv` og var 3 af de 40 varer paa
    // /tilbud, da en ekstern SEO-audit faldt over dem.
    expect(kategoriFraNavn("Point Virgule Tjenerkniv/proptrækker I Rustfri Stål/træ - Multitool")).toBeNull();
    expect(kategoriFraNavn("Point Virgule Tjenerkniv/proptrækker I Stål/plast - Multitool")).toBeNull();
  });
  it("tager stadig en rigtig kniv og et rigtigt multitool", () => {
    expect(kategoriFraNavn("Morakniv Companion - Kniv")).toBe("kniv");
    expect(kategoriFraNavn("Leatherman Wave Plus - Multitool")).toBe("kniv");
  });
});

/**
 * Det sikre navnelag er det ENESTE sted, hvor navnet maa overskrive feedets
 * egen kortlaegning, saa proeverne her er delt i to: de otte varer laget skal
 * flytte, og de navne der ligner ild men ikke er det. Alle navne er rigtige
 * katalognavne, maalt 31. oktober 2026.
 */
describe("sikkerKategoriFraNavn: optaending der laa i en forkert gren", () => {
  const FLYTTES: string[] = [
    // De fire /bedste/taendstaal-varer, hvis gren rummer alt andet.
    "Optænding - Light My Fire TinderSticks - 180-220 gram", // laa i kogeudstyr
    "Tændstål - Light My Fire FireSteel BIO - Sort", // laa i prepping
    "Lifesystems Firestarter - Tilbehør til camping", // laa i tilbehoer
    "Gerber Fire Starter praktisk ildstål | Outmore.dk", // laa i kogeudstyr
    // Samme fejl, samme gren, fundet i samme maaling.
    "Båltændingssæt - Light My Fire Firelighting Kit BIO",
    "Vandtætte tændstikker - Lifesystems - Refill pakke - 15-stk",
    "Vandtætte tændstikker inkl. etui - Lifesystems - 25-stk",
    // outmore::"Tændstål" har slet ingen kortlaegningsraekke, saa den her laa
    // uden kategori, fordi navnet siger FireLighting og ikke FireSteel.
    "Light My Fire FireLighting Kit BIO sandygreen/cocoshell - sandygreen-cocoshell",
  ];
  it.each(FLYTTES)("%s er sikkert taendstaal", (navn) => {
    expect(sikkerKategoriFraNavn(navn)).toBe("taendstaal");
  });

  it("svarer det samme som den brede regel, hvor begge svarer", () => {
    expect(kategoriFraNavn("Kupilka Firesteel 8")).toBe("taendstaal");
    expect(sikkerKategoriFraNavn("Kupilka Firesteel 8")).toBe("taendstaal");
  });
});

describe("sikkerKategoriFraNavn: navne der ligner ild uden at vaere det", () => {
  /**
   * Det her er hele grunden til, at moensteret er snaevert. Laget overskriver
   * en bevidst kortlaegning, saa ét forkert traef her flytter en loebevest
   * eller en sovepose ind i taendstaal-puljen.
   */
  const RORES_IKKE: [string, string | null][] = [
    ["Camelbak Women's Zephyr Pro - Flint Grey - Str. ONE SIZE - Løbevest", null],
    ["Regnjakke Unisex - Trespass Qikpac - Flint Sort", "regntoj"],
    ["Vandresko til dame - Merrell Speed Strike 2 WP - Grå", "fodtoj"],
    ["Cebe Striker2 L Black - Skibriller", null],
    ["Sea To Summit Spark -18c Down Sleeping Bag - Large Beluga Black", "sovepose"],
    ["Firepot Chili Con Carne Med Ris - Reg - Mad", null],
    ["Petromax Fire Skillet Fp30 With One Pan Handle - Pande", "baaludstyr"],
    ["Petromax Fire Kettle Stainless Steel 0,75l - Kedel", "kogeudstyr"],
    ["Gentlemen's Hardware Campfire Chess - Spil", null],
    ["Winnerwell L-sized Flat Firepit - Bålsted", "baaludstyr"],
    // Staar som kniv paa sitet, men det kommer fra outmore::Kniv-kortlaegningen:
    // \bkniv\b rammer ikke "Morakniv". Netop derfor maa det sikre lag ikke
    // svare paa den, for saa ville en kniv blive et taendstaal.
    ["Morakniv Eldris With Fire Kit (s) Black", null],
    ["Silva Ignite - Pandelampe", "pandelampe"],
    ["2XU Ignition Hyper-Haptic Beanie Surf/silver Reflective", "hue"],
    ["Biolite Firepit Carry Bag - Taske", null],
  ];
  it.each(RORES_IKKE)("%s roeres ikke af det sikre lag", (navn) => {
    expect(sikkerKategoriFraNavn(navn)).toBeNull();
  });

  it("lader den brede regel beholde sit eget svar paa de samme navne", () => {
    for (const [navn, bred] of RORES_IKKE) {
      expect(kategoriFraNavn(navn), navn).toBe(bred);
    }
  });

  it("giver ingen kategori til en engrospakke, heller ikke med et sikkert navn", () => {
    // ENGROS gaelder foer alt andet, ogsaa her. Varen blev slettet fra
    // /bedste/taendstaal netop fordi den er en 50-grams engrospakke.
    expect(sikkerKategoriFraNavn("Light My Fire Tinder-on-a-Rope, 50g bulk")).toBeNull();
  });

  it("udelukker optaending der kun er en bivare", () => {
    // Begge laa som taendstaal, fordi "optænding" stod i navnet.
    expect(
      sikkerKategoriFraNavn("Brænder - Esbit Emergency Stove - inkl. 3x14 g optændingstabletter")
    ).toBeNull();
    expect(
      kategoriFraNavn("Brænder - Esbit Emergency Stove - inkl. 3x14 g optændingstabletter")
    ).toBeNull();
    expect(kategoriFraNavn("Robens Paracord reb med optændingsmulighed")).toBeNull();
  });
});
