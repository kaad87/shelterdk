import { describe, expect, it } from "vitest";
import {
  kategoriFor,
  prisOk,
  FEED_KATEGORIER,
  FEED_KATEGORI_MAP,
} from "@/lib/feed-kategori-filter";
import { navneKategorier } from "@/lib/kategori-fra-navn";

describe("kategoriFor", () => {
  it("tager ikke sutsko og hjemmesko med som vandresandal", () => {
    // "NOU Emilian W Leather Cork Moc" beskriver sig selv som damesutsko.
    expect(kategoriFor("NOU Emilian W Leather Cork Moc V2", "Sandaler")).toBeNull();
    expect(kategoriFor("Glerups Slipper Wool", "Fodtøj")).toBeNull();
  });

  it("tager ikke byjakker og lange frakker med som dunjakke", () => {
    expect(kategoriFor("Patagonia Mens Cotton Down Jacket", "Jakker")).toBeNull();
    expect(kategoriFor("Patagonia Womens Cotton Down Parka", "Jakker")).toBeNull();
    expect(kategoriFor("Helly Hansen Womens Essence Long Down Coat", "Jakker")).toBeNull();
    expect(kategoriFor("Berghaus Mens Explorer Down Jacket", "Jakker")).toBe("dunjakke");
  });

  it("fanger de fem kategorier vi importerer", () => {
    expect(kategoriFor("Keen Newport H2 Sandal", "Sandaler")).toBe("vandresandal");
    expect(kategoriFor("Patagonia Better Sweater Fleece", "Fleecejakker")).toBe("fleece");
    expect(kategoriFor("Rab Microlight Dunjakke", "Jakker")).toBe("dunjakke");
    expect(kategoriFor("Fjällräven Abisko Trekkingbukser", "Bukser")).toBe("vandrebukser");
    expect(kategoriFor("Buff Bøllehat", "Huer og kasketter")).toBe("solhat");
  });

  it("lader alt andet ligge", () => {
    // Pro Outdoor har 49.556 varer og Outdoornu 32.611. Importeres de hele,
    // sekstendobles en tabel hvor 98 % allerede er ubrugt.
    for (const navn of [
      "Savage Gear Spinnestang 9 fod",
      "Shimano Spinnehjul 4000",
      "Garmin Metaldetektor",
      "Herre Skjorte Flannel",
      "Badeshorts Trunks Navy",
    ]) {
      expect(kategoriFor(navn, "Diverse"), navn).toBeNull();
    }
  });

  it("skelner en fleecehandske fra en fleecetrøje", () => {
    // Udelukkelsen laeses paa produktNAVNET, ikke paa kategorinavnet, saa en
    // handske i kategorien "Fleecejakker" stadig falder fra.
    expect(kategoriFor("Fleece Handsker Sort", "Fleecejakker")).toBeNull();
    expect(kategoriFor("Fleece Hue", "Huer")).toBeNull();
    expect(kategoriFor("Fleece Sokker", "Sokker")).toBeNull();
  });

  it("tager en dunvest med som dunjakke", () => {
    // Der er ikke laengere en vestkategori: \bvest\b fangede jagtveste,
    // loebeveste, varmeveste og et landkort ("Kyst til Kyst Vest"). Dunveste
    // er det eneste fra den gruppe vi vil have, og de fanges her.
    expect(kategoriFor("Rab Microlight Dunvest", "Veste")).toBe("dunjakke");
    expect(kategoriFor("Haglöfs Mimic Vest", "Veste")).toBeNull();
    expect(kategoriFor("Calazo Kyst til Kyst Vest - Blåvands Huk 1:25000", "Kort")).toBeNull();
    expect(kategoriFor("Pinewood Dogsport 2.0 Vest Dame", "Veste")).toBeNull();
  });

  it("tager ikke en redningsvest med", () => {
    expect(kategoriFor("Redningsvest 50N Voksen", "Veste")).toBeNull();
    expect(kategoriFor("Refleksvest gul", "Sikkerhed")).toBeNull();
  });

  it("tager ikke hundeudstyr og boernetoej med", () => {
    expect(kategoriFor("Hundesandal pote", "Hund")).toBeNull();
    expect(kategoriFor("Børne fleecetrøje", "Børn")).toBeNull();
  });

  it("tager imod en tom kategori fra feedet", () => {
    expect(kategoriFor("Patagonia Fleece Jakke", null)).toBe("fleece");
    expect(kategoriFor("", null)).toBeNull();
  });

  it("har ikke to regler med samme kategori", () => {
    const k = FEED_KATEGORIER.map((x) => x.kategori);
    expect(new Set(k).size).toBe(k.length);
  });
});

describe("laek fundet i de rigtige feeds", () => {
  it("udelukker teenage- og ungdomsvarer", () => {
    // Slap igennem, da ALDRIG kun havde danske ord. Feedenes navne er engelske.
    expect(kategoriFor("The North Face Teen Reversible North Down Jacket", "Jakker > Dunjakker")).toBeNull();
    expect(kategoriFor("Youth Fleece Jacket", "Fleece")).toBeNull();
    expect(kategoriFor("Boys Zip-Off Trousers", "Bukser")).toBeNull();
  });

  it("udelukker en vare i boerne-grenen af kategoritraeet, selv om navnet er neutralt", () => {
    expect(kategoriFor("Glacier Full Zip", "Brands > The North Face > Børn > Fleece")).toBeNull();
  });

  it("tager ikke en bomuldshaettetroeje med, blot fordi den ligger i fleece-kategorien", () => {
    expect(kategoriFor("Mens Drew Peak Pullover Hoodie", "Overdele > Fleece")).toBeNull();
    expect(kategoriFor("Mens Crewneck Sweatshirt", "Overdele > Fleece")).toBeNull();
  });

  it("beholder en rigtig fleecehoodie", () => {
    expect(kategoriFor("Mens Canyonlands Fleece Hoodie", "Overdele > Fleece")).toBe("fleece");
  });
});

describe("prisOk", () => {
  it("holder en parka til 13.000 kr ude af dunjakke", () => {
    expect(prisOk("dunjakke", 2499)).toBe(true);
    expect(prisOk("dunjakke", 13049.95)).toBe(false);
  });

  it("laader kategorier uden graense vaere", () => {
    expect(prisOk("lejrsko", 99999)).toBe(true);
  });

  it("siger ja til en kategori den ikke kender", () => {
    // Saa en stavefejl i importkoden ikke tavst smider alt vaek.
    expect(prisOk("findes-ikke", 500)).toBe(true);
  });
});

describe("kikkert og oekse", () => {
  it("fanger kikkerter, ogsaa med engelske navne", () => {
    expect(kategoriFor("Carson Scout 8x22mm kikkert - JD-822", "Optik")).toBe("kikkert");
    expect(kategoriFor("Nikon Prostaff Binocular 8x42", "Optik")).toBe("kikkert");
  });

  it("tager ikke optik-tilbehoer eller jagtoptik med", () => {
    expect(kategoriFor("Kikkert stativ aluminium", "Optik")).toBeNull();
    expect(kategoriFor("Kikkerttaske neopren", "Optik")).toBeNull();
    expect(kategoriFor("Natkigger termisk monokular", "Optik")).toBeNull();
    expect(kategoriFor("Sigtekikkert 3-9x40", "Optik")).toBeNull();
  });

  it("fanger oekser og save til baalet", () => {
    expect(kategoriFor("Økse - Survival - Inkl etui", "Værktøj")).toBe("oekse");
    expect(kategoriFor("Opinel Foldesav 18cm Bøg", "Værktøj")).toBe("oekse");
    expect(kategoriFor("Gerber Freescape Camp Saw", "Værktøj")).toBe("oekse");
  });

  it("tager ikke knive og macheter med, selv om de ligger i oekse-kategorien", () => {
    // Hos Outdoor I Centrum ligger knive og oekser i samme kategorigren, og
    // kategorien trak ni knive, macheter og et multitool-saet med ind.
    expect(kategoriFor("Highlander Kingfisher Kniv 9,5 cm", "Knive & Økser")).toBeNull();
    expect(kategoriFor("Gerber Bolo Machete", "Knive, Økser og Save")).toBeNull();
    expect(kategoriFor("Kinetic Multi Tool Set", "Knive & Økser")).toBeNull();
    expect(kategoriFor("Savotta Tool Pocket Black", "Knive & Økser")).toBeNull();
    // men en rigtig oekse i samme gren skal stadig med
    expect(kategoriFor("Helko Werk Black Forest Pack Økse", "Knive & Økser")).toBe("oekse");
  });

  it("tager ikke jagtoptik med, selv om det ligger i Optik", () => {
    expect(kategoriFor("Afstandsmåler laser 1000m", "Optik")).toBeNull();
    expect(kategoriFor("Carson Scout 8x22mm kikkert", "Optik")).toBe("kikkert");
  });

  it("tager ikke en hakke eller en motorsav med", () => {
    // "Swagier Pick axe" slap igennem paa \baxe\b. En hakke er til at grave med.
    expect(kategoriFor("Swagier Pick axe", "Værktøj")).toBeNull();
    expect(kategoriFor("Motorsav benzin 45cm", "Værktøj")).toBeNull();
    expect(kategoriFor("Savklinge til buesav", "Værktøj")).toBeNull();
  });
});

describe("ALDRIG: Barn Red er en farve", () => {
  it("afviser ikke en vare hvis farve er Barn Red", () => {
    // Maalt: \bbarn\b matchede praecis to af 17.220 produkter, og begge var
    // farven "Barn Red" paa et Primus-taendstaal. Proeves her gennem fleece,
    // fordi det er en kategori filteret kender.
    expect(kategoriFor("Pinewood Tiveden Fleece Barn Red", "fleecetrøjer")).toBe("fleece");
  });

  it("afviser stadig rigtige boerneprodukter", () => {
    expect(kategoriFor("Fleecetrøje til børn - Treklife", "fleece")).toBeNull();
    expect(kategoriFor("Tatonka Gaiter 420hd Junior", "gamacher")).toBeNull();
  });
});

describe("opslag paa feedets egen kategoriliste", () => {
  // Outnorths kategorinavne er flade og danske, saa de kan slaas op direkte.
  // Alle tre navne herunder er taget raat fra feedet.
  it("tager Outnorths kategori naar navnet ikke siger noget", () => {
    // "Bergans Trollhetta Tunnel 3 Tent Light Fogblue" har intet dansk
    // teltord, og reglerne ovenfor kan derfor ikke se den.
    expect(kategoriFor("Bergans Trollhetta Tunnel 3 Tent", "Tunneltelte", "outnorth")).toBe("telt");
    expect(kategoriFor("Nemo Fillo Black Pearl", "Puder", "outnorth")).toBe("soveudstyr");
    expect(kategoriFor("Mora Eldris Blue", "Knive", "outnorth")).toBe("kniv");
  });

  it("slaar kun op for det feed kortet hoerer til", () => {
    // De to store partner-ads-feeds skal ikke aendre udvalg, fordi Outnorth
    // kom til. Deres kategorinavne er grene i et traee og rammer ikke, men
    // vagten skal staa alligevel.
    expect(kategoriFor("Nemo Fillo Black Pearl", "Puder", "prooutdoor")).toBeNull();
    expect(kategoriFor("Nemo Fillo Black Pearl", "Puder")).toBeNull();
  });

  it("springer ikke udelukkelsen i reglen over", () => {
    // Grenen hedder "Dunjakker", men reglen ovenfor har brugt tre linjer paa
    // at holde bomuldsparkaer ude, og et opslag maa ikke vaere en bagdoer.
    expect(kategoriFor("Patagonia Mens Cotton Down Jacket", "Dunjakker", "outnorth")).toBeNull();
    expect(kategoriFor("Berghaus Mens Explorer Down Jacket", "Dunjakker", "outnorth")).toBe("dunjakke");
  });

  it("holder boernevarer ude ogsaa naar kategorien rammer", () => {
    expect(kategoriFor("Petzl Tikkid Junior", "Pandelamper", "outnorth")).toBeNull();
  });

  it("tager tilbehoer og reservedele ud", () => {
    // Maalt paa feedet: 6 af 20 vandrestave var spidser og kurve, og 7 af 20
    // vandfiltre var reservedele.
    expect(kategoriFor("Silva Carbide Tips Nocolour", "Vandrestave", "outnorth")).toBeNull();
    expect(kategoriFor("Swix Trail Basket Black", "Vandrestave", "outnorth")).toBeNull();
    expect(kategoriFor("Katadyn Combi Carbon Replacement Pack", "Vandrensning", "outnorth")).toBeNull();
    expect(kategoriFor("Casström No 11 Field Saw - Spare Blade", "Knive", "outnorth")).toBeNull();
    expect(kategoriFor("BioLite 12V Car Charging Cable 3 m", "Powerbanker & opladere", "outnorth")).toBeNull();
    // Og den rigtige vare i samme gren skal stadig med.
    expect(kategoriFor("Leki Cross Trail Fx Superlite", "Vandrestave", "outnorth")).toBe("vandrestav");
    expect(kategoriFor("Thule Power Bank 10k Black", "Powerbanker & opladere", "outnorth")).toBe("elektronik");
  });

  it('lader "kit" staa, fordi First Aid Kit er selve varen', () => {
    expect(kategoriFor("VAUDE First Aid Kit M Lava", "Førstehjælp", "outnorth")).toBe("foerstehjaelp");
    expect(kategoriFor("Opinel Maintenance Kit", "Knive", "outnorth")).toBeNull();
  });

  it("renser de grene feedet selv blander", () => {
    // "Tarp & Shelters" rummer bivyposer og telte, "Flasker" rummer
    // vandfiltre, og "Puder" rummer nakkepuder til fly.
    expect(kategoriFor("Exped Bivybag Lite Ventair/PU", "Tarp & Shelters", "outnorth")).toBeNull();
    expect(kategoriFor("iFish Glamp X 365-9 Pop-up Tent 9-p", "Tarp & Shelters", "outnorth")).toBeNull();
    expect(kategoriFor("Robens Tarp 4 X 4 M Green", "Tarp & Shelters", "outnorth")).toBe("tarp");
    expect(kategoriFor("Katadyn Befree Gravity Filter 6 L", "Flasker", "outnorth")).toBeNull();
    expect(kategoriFor("Nalgene 500ml Wide Mouth Sustain", "Flasker", "outnorth")).toBe("drikkedunk");
    expect(kategoriFor("Eagle Creek Memory Foam Neck Pillow", "Puder", "outnorth")).toBeNull();
    expect(kategoriFor("Therm-a-Rest Air Head Pillow L", "Puder", "outnorth")).toBe("soveudstyr");
  });

  it("falder tilbage paa reglerne naar kategorien ikke staar i kortet", () => {
    // "Mellemlag" blander fleece og syntetisk fyld, saa den er bevidst ikke i
    // kortet: navnet kan se forskel, kategorien kan ikke.
    expect(kategoriFor("Patagonia Better Sweater Fleece", "Mellemlag", "outnorth")).toBe("fleece");
    expect(kategoriFor("Haglöfs Barrier Hood", "Mellemlag", "outnorth")).toBeNull();
  });

  it("peger kun paa kategorier der findes i forvejen", () => {
    const kendte = new Set([...FEED_KATEGORIER.map((k) => k.kategori), ...navneKategorier()]);
    for (const kort of Object.values(FEED_KATEGORI_MAP)) {
      for (const [gren, kat] of Object.entries(kort)) {
        expect(kendte.has(kat), `${gren} -> ${kat}`).toBe(true);
      }
    }
  });
});

describe("finere opdeling end feedets egen gren", () => {
  it("flytter siddeunderlag ud af campingmoebler", () => {
    // Outnorth har ingen siddeunderlags-gren. Syv af de tyve varer, loftet
    // lukkede ind under campingmoebler, var siddeunderlag, mens
    // /bedste/siddeunderlag kun havde 16 varer i hele kataloget.
    for (const n of [
      "Woolpower Sit Pad Recycled Grey",
      "Fjällräven G1000 Seat Pad Dark Grey",
      "Sea To Summit Air Seat Olive",
      "Klymit V-seat Grey",
      "iFish Heat-seat Black",
      "Urberg Alu Foldable Seat Pad Silver",
    ]) {
      expect(kategoriFor(n, "Campingmøbler", "outnorth"), n).toBe("siddeunderlag");
    }
  });

  it("lader stole og borde blive i campingmoebler", () => {
    // Snaevert med vilje: et bredt \bseat\b ville tage en stol med over.
    for (const n of [
      "Helinox Swivel Chair Black/O Blue",
      "Easy Camp Alder Table Brown",
      "Nemo Moonlite Elite Reclining Camp Chair Lake",
      "Coleman Furn Quad Chair Steel Grey",
    ]) {
      expect(kategoriFor(n, "Campingmøbler", "outnorth"), n).toBe("campingmobler");
    }
  });
});

describe("myggenet", () => {
  it("tager nettene fra Insektbeskyttelse", () => {
    for (const n of [
      "Cocoon Head Net Ultralight Black",
      "Sea To Summit Nano Mosquito Net Double Grey",
      "Eagle Nest Outfitters Guardian Bug Net Black",
      "Helsport Mosquito Mesh Cover Green",
    ]) {
      expect(kategoriFor(n, "Insektbeskyttelse", "outnorth"), n).toBe("myggenet");
    }
  });

  it("lader kemien og dimserne ligge", () => {
    // En guide til myggenet, der anbefaler DEET, er ikke en guide til myggenet.
    for (const n of [
      "Mygga Mosquito Spray",
      "Mygga Roll On Nocolour",
      "Mygga After Bite Insect Gel Nocolour",
      "Care Plus Anti-Insect DEET 40% 60 ml NoColour",
      "Tickless Human Green",
      "Moskitofree Travel White",
      "Sjö & Hav Mygg+Fästing Spray Nocolour",
      // "ljus" er et suffiks her, saa \bljus\b ramte det ikke.
      "Sjö & Hav Myggljus/Sommarljus Nocolour",
    ]) {
      expect(kategoriFor(n, "Insektbeskyttelse", "outnorth"), n).toBeNull();
    }
  });
});
