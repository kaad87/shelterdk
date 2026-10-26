import { describe, expect, it } from "vitest";
import { kategoriFraNavn } from "../kategori-fra-navn";

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
});
