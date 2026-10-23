import { describe, expect, it } from "vitest";
import { basisNavn, vaelgUdvalg, MIN_TEKST, type UdvalgVare } from "@/lib/feed-udvalg";

const TEKST = "x".repeat(MIN_TEKST);

function vare(o: Partial<UdvalgVare> & { id: string }): UdvalgVare {
  return {
    brand: "Brand",
    product_name: "Model",
    description: TEKST,
    price: 100,
    in_stock: true,
    ...o,
  };
}

const altErFleece = () => "fleece";

describe("basisNavn", () => {
  it("skaerer farven af, men ikke koen", () => {
    expect(basisNavn("Abisko Trail Trousers Mens, Suede Brown")).toBe("Abisko Trail Trousers Mens");
    expect(basisNavn("Terra Fi Lite Herre, Dark Olive / Desert Palm")).toBe("Terra Fi Lite Herre");
  });

  it("laader et navn uden komma vaere", () => {
    expect(basisNavn("Broadcaster Hat")).toBe("Broadcaster Hat");
  });

  it("laeser ogsaa Outdoornus bindestregsformat", () => {
    // Med kun komma-reglen blev fire farver i fire stoerrelser seksten modeller.
    expect(basisNavn("Fjällräven Singi Down Jacket Women-black-L")).toBe("Fjällräven Singi Down Jacket Women");
    expect(basisNavn("Fjällräven Singi Down Jacket Women-dark navy-XL")).toBe("Fjällräven Singi Down Jacket Women");
    expect(basisNavn("Pinewood Wildmark / Sahara Zip-Off buks-green-50")).toBe("Pinewood Wildmark / Sahara Zip-Off buks");
    expect(basisNavn("Cruz Aarhus W sandal, black-36")).toBe("Cruz Aarhus W sandal");
    expect(basisNavn("Salomon Techamphibian 5.0 Women, peat/rainy/h.pink-38 2/3 / UK 5,5")).toBe("Salomon Techamphibian 5.0 Women");
  });

  it("spiser ikke modelnavnet, naar det sidste led ikke er en farve", () => {
    // Stoerrelsen ryger, men "vest" er modellen og skal blive staaende.
    expect(basisNavn("Pinewood Furudal Hunter Pro vest-3XL")).toBe("Pinewood Furudal Hunter Pro vest");
    expect(basisNavn("Fjällräven Vidda Pro Lite Zip-Off Trousers Men-dark grey-44-regular"))
      .toBe("Fjällräven Vidda Pro Lite Zip-Off Trousers Men");
  });

  it("holder herre og dame adskilt i begge formater", () => {
    expect(basisNavn("Teva Terra Fi Lite Herre, Black")).not.toBe(basisNavn("Teva Terra Fi Lite Dame, Black"));
    expect(basisNavn("Aclima Fleecewool Jacket Men, black-XL")).not.toBe(basisNavn("Aclima Fleecewool Jacket Women, black-XL"));
  });
});

describe("vaelgUdvalg", () => {
  it("springer varer uden lager eller uden brugbar tekst over", () => {
    const { valgte } = vaelgUdvalg(
      [
        vare({ id: "a" }),
        vare({ id: "b", in_stock: false }),
        vare({ id: "c", product_name: "Anden", description: "for kort" }),
        vare({ id: "d", product_name: "Tredje", description: null }),
      ],
      altErFleece,
      new Set(),
      10
    );
    expect(valgte.map((v) => v.id)).toEqual(["a"]);
  });

  it("folder farve- og stoerrelsesvarianter til én model og tager den billigste", () => {
    const { valgte } = vaelgUdvalg(
      [
        vare({ id: "sort", product_name: "Glacier FZ, Black", price: 500 }),
        vare({ id: "blaa", product_name: "Glacier FZ, Navy", price: 420 }),
        vare({ id: "groen", product_name: "Glacier FZ, Green", price: 480 }),
      ],
      altErFleece,
      new Set(),
      10
    );
    expect(valgte.map((v) => v.id)).toEqual(["blaa"]);
  });

  it("holder herre og dame adskilt", () => {
    const { valgte } = vaelgUdvalg(
      [
        vare({ id: "h", product_name: "Glacier FZ Mens, Black" }),
        vare({ id: "d", product_name: "Glacier FZ Womens, Black" }),
      ],
      altErFleece,
      new Set(),
      10
    );
    expect(valgte).toHaveLength(2);
  });

  it("respekterer loftet", () => {
    // Nok maerker til at maerkegraensen ikke er den bindende: det er loftet vi
    // maaler her.
    const varer = Array.from({ length: 50 }, (_, i) =>
      vare({ id: `p${String(i).padStart(2, "0")}`, brand: `B${i % 10}`, product_name: `Model ${i}` })
    );
    const { valgte, prKategori } = vaelgUdvalg(varer, altErFleece, new Set(), 20);
    expect(valgte).toHaveLength(20);
    expect(prKategori.get("fleece")).toBe(20);
  });

  it("rammer flere brands frem for at fylde loftet med ét", () => {
    const varer = [
      ...Array.from({ length: 10 }, (_, i) =>
        vare({ id: `tnf${i}`, brand: "The North Face", product_name: `TNF ${i}` })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        vare({ id: `pat${i}`, brand: "Patagonia", product_name: `Pata ${i}` })
      ),
    ];
    const { valgte } = vaelgUdvalg(varer, altErFleece, new Set(), 4);
    const brands = new Set(valgte.map((v) => v.brand));
    expect(brands).toEqual(new Set(["The North Face", "Patagonia"]));
  });

  it("skubber ikke en gemt vare ud for at gøre plads til en ny", () => {
    // Det er hele pointen med loftet. "aaa" sorterer foerst og ville ellers
    // tage pladsen fra "zzz", som en live guide kan pege paa.
    const gammel = vare({ id: "zzz", product_name: "Gammel model" });
    const ny = vare({ id: "aaa", product_name: "Ny model" });
    const { valgte } = vaelgUdvalg([ny, gammel], altErFleece, new Set(["zzz"]), 1);
    expect(valgte.map((v) => v.id)).toEqual(["zzz"]);
  });

  it("beholder alle gemte, ogsaa over loftet", () => {
    const varer = Array.from({ length: 5 }, (_, i) =>
      vare({ id: `g${i}`, product_name: `Model ${i}` })
    );
    const { valgte } = vaelgUdvalg(varer, altErFleece, new Set(varer.map((v) => v.id)), 2);
    expect(valgte).toHaveLength(5);
  });

  it("vaelger samme variant igen, naar en af dem allerede er gemt", () => {
    // Uden klaebning ville den billigste variant vinde, og et prisfald paa en
    // anden farve ville flytte guidens produkt til en ny raekke.
    const varer = [
      vare({ id: "sort", product_name: "Glacier FZ, Black", price: 500 }),
      vare({ id: "blaa", product_name: "Glacier FZ, Navy", price: 420 }),
    ];
    const { valgte } = vaelgUdvalg(varer, altErFleece, new Set(["sort"]), 10);
    expect(valgte.map((v) => v.id)).toEqual(["sort"]);
  });

  it("giver samme resultat uanset feedets raekkefoelge", () => {
    const varer = Array.from({ length: 30 }, (_, i) =>
      vare({ id: `p${String(i).padStart(2, "0")}`, brand: `B${i % 4}`, product_name: `Model ${i}` })
    );
    const a = vaelgUdvalg(varer, altErFleece, new Set(), 8).valgte.map((v) => v.id).sort();
    const b = vaelgUdvalg([...varer].reverse(), altErFleece, new Set(), 8).valgte.map((v) => v.id).sort();
    expect(a).toEqual(b);
  });

  it("tager ikke mere end et par modeller fra samme maerke", () => {
    // Tolv af atten vandrebukser var Fjällräven, fordi feedet har ti
    // zip-off-modeller fra dem alene. Loft 10 giver hoejst to pr. maerke.
    const varer = [
      ...Array.from({ length: 10 }, (_, i) =>
        vare({ id: `fj${i}`, brand: "Fjällräven", product_name: `Model ${i}` })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        vare({ id: `cmp${i}`, brand: "CMP", product_name: `CMP ${i}` })
      ),
    ];
    const { valgte } = vaelgUdvalg(varer, altErFleece, new Set(), 10);
    const fj = valgte.filter((v) => v.brand === "Fjällräven");
    expect(fj.length).toBeLessThanOrEqual(2);
  });

  it("taeller de gemte med i maerkegraensen, men skubber dem ikke ud", () => {
    const gamle = Array.from({ length: 5 }, (_, i) =>
      vare({ id: `g${i}`, brand: "Fjällräven", product_name: `Gammel ${i}` })
    );
    const nye = Array.from({ length: 5 }, (_, i) =>
      vare({ id: `n${i}`, brand: "Fjällräven", product_name: `Ny ${i}` })
    );
    const { valgte } = vaelgUdvalg([...gamle, ...nye], altErFleece, new Set(gamle.map((v) => v.id)), 10);
    expect(valgte.map((v) => v.id).sort()).toEqual(gamle.map((v) => v.id).sort());
  });

  it("bruger foerste ord i navnet som maerke, naar feedet ikke har et", () => {
    // To Aclima-fleecer har brand=null i Pro Outdoors feed, mens resten har
    // "Aclima". Uden dette blev de deres eget maerke og fik egne pladser.
    const varer = [
      vare({ id: "a1", brand: "Aclima", product_name: "Aclima FleeceWool Crewneck Mens, Navy" }),
      vare({ id: "a2", brand: null, product_name: "Aclima FleeceWool Crewneck Womens, Corsair" }),
      vare({ id: "a3", brand: null, product_name: "Aclima FleeceWool V2 Crewneck Mens, Navy" }),
      vare({ id: "a4", brand: "Aclima", product_name: "Aclima FleeceWool V2 Crewneck Womens, Corsair" }),
      vare({ id: "b1", brand: "Berghaus", product_name: "Berghaus Kinetic Hoody, Black" }),
    ];
    const { valgte } = vaelgUdvalg(varer, altErFleece, new Set(), 10);
    const aclima = valgte.filter((v) => v.product_name.startsWith("Aclima"));
    expect(aclima.length).toBeLessThanOrEqual(2);
  });

  it("kan overstyre maerkegraensen for et feed med ét maerke", () => {
    // Zeejuu har 26 kikkerter paa lager, naesten alle Carson. Den udledte
    // graense paa tre skar kategorien til fire varer, altsaa for lidt til en
    // guide.
    const varer = Array.from({ length: 20 }, (_, i) =>
      vare({ id: `c${String(i).padStart(2, "0")}`, brand: "Carson", product_name: `Carson ${i}` })
    );
    expect(vaelgUdvalg(varer, altErFleece, new Set(), 12).valgte).toHaveLength(3);
    expect(vaelgUdvalg(varer, altErFleece, new Set(), 12, 8).valgte).toHaveLength(8);
  });

  it("holder kategorierne hver for sig", () => {
    const { prKategori } = vaelgUdvalg(
      [
        vare({ id: "f1", product_name: "Fleece" }),
        vare({ id: "s1", product_name: "Sandal" }),
        vare({ id: "s2", product_name: "Anden sandal" }),
      ],
      (v) => (v.product_name.toLowerCase().includes("sandal") ? "lejrsko" : "fleece"),
      new Set(),
      10
    );
    expect(prKategori.get("fleece")).toBe(1);
    expect(prKategori.get("lejrsko")).toBe(2);
  });
});
