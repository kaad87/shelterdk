import { describe, it, expect } from "vitest";
import { buildItemListSchema, buildProductSchema } from "@/lib/buying-guides-schema";

const product = {
  id: "backpackerlife-72997",
  description: "En god 3-sæsons sovepose til shelterture i Danmark.",
  shipping_cost: null,
  product_name: "Test Sovepose",
  brand: "Acme",
  image_url: "https://x/i.jpg",
  price: 999,
  affiliate_url: "https://shop/x",
  retailer: "backpackerlife",
  in_stock: true,
} as Parameters<typeof buildProductSchema>[0];

describe("buildItemListSchema", () => {
  it("laver ItemList med position pr. produkt", () => {
    const s = buildItemListSchema(
      [{ product }, { product }],
      "https://shelterdk.dk/bedste/sovepose"
    );
    expect(s["@type"]).toBe("ItemList");
    expect((s.itemListElement as unknown[]).length).toBe(2);
    expect((s.itemListElement as { position: number }[])[0].position).toBe(1);
    expect((s.itemListElement as { position: number }[])[1].position).toBe(2);
  });

  it("sender score videre til Product-review", () => {
    const s = buildItemListSchema([{ product, score: 8.7 }], "https://x");
    const item = (s.itemListElement as { item: Record<string, unknown> }[])[0].item;
    expect(item.review).toBeDefined();
  });
});

describe("buildProductSchema", () => {
  it("inkluderer navn, brand og offers med pris i DKK", () => {
    const s = buildProductSchema(product);
    expect(s["@type"]).toBe("Product");
    // Navnet kommer fra rentNavn(), som saetter maerket foran naar det ikke
    // staar i navnet. Google og en chatbot ser dermed samme entitet som
    // brugeren laeser paa kortet.
    expect(s.name).toBe("Acme Test Sovepose");
    expect((s.offers as { price: number }).price).toBe(999);
    expect((s.offers as { priceCurrency: string }).priceCurrency).toBe("DKK");
  });

  it("udelader brand når null", () => {
    const s = buildProductSchema({ ...product, brand: null });
    expect(s.brand).toBeUndefined();
  });

  it("tilføjer review når score er sat", () => {
    const s = buildProductSchema({ ...product }, { score: 8.7 });
    const r = s.review as {
      reviewRating: { ratingValue: number; bestRating: number };
      author: { name: string };
    };
    expect(r.reviewRating.ratingValue).toBe(8.7);
    expect(r.reviewRating.bestRating).toBe(10);
    expect(r.author.name).toMatch(/ShelterDK/);
  });

  it("uden score → intet review-felt", () => {
    expect(buildProductSchema({ ...product }).review).toBeUndefined();
  });
});

describe("buildProductSchema – lager, pros/cons, reviewBody, priceValidUntil", () => {
  it("sætter OutOfStock når produktet er udsolgt", () => {
    const s = buildProductSchema({ ...product, in_stock: false });
    expect((s.offers as { availability: string }).availability).toBe(
      "https://schema.org/OutOfStock"
    );
  });

  it("sætter InStock når produktet er på lager", () => {
    const s = buildProductSchema({ ...product, in_stock: true });
    expect((s.offers as { availability: string }).availability).toBe(
      "https://schema.org/InStock"
    );
  });

  it("lægger pros/cons i review som positiveNotes/negativeNotes (ItemList)", () => {
    const s = buildProductSchema(
      { ...product, in_stock: true },
      { score: 8.5, pros: ["Varm", "Let"], cons: ["Stor pakstørrelse"] }
    );
    const review = s.review as Record<string, unknown>;
    const pos = review.positiveNotes as { itemListElement: { name: string; position: number }[] };
    const neg = review.negativeNotes as { itemListElement: { name: string }[] };
    expect(pos.itemListElement.map((x) => x.name)).toEqual(["Varm", "Let"]);
    expect(pos.itemListElement[0].position).toBe(1);
    expect(neg.itemListElement[0].name).toBe("Stor pakstørrelse");
  });

  it("udelader positiveNotes/negativeNotes uden pros/cons", () => {
    const s = buildProductSchema({ ...product, in_stock: true }, { score: 8.5 });
    const review = s.review as Record<string, unknown>;
    expect(review.positiveNotes).toBeUndefined();
    expect(review.negativeNotes).toBeUndefined();
  });

  it("bruger editorial note som reviewBody", () => {
    const s = buildProductSchema(
      { ...product, in_stock: true },
      { score: 9, reviewBody: "Vores favorit til vinterbrug." }
    );
    expect((s.review as { reviewBody: string }).reviewBody).toBe(
      "Vores favorit til vinterbrug."
    );
  });

  it("sætter rullende priceValidUntil (~30 dage frem)", () => {
    const s = buildProductSchema({ ...product, in_stock: true });
    const until = (s.offers as { priceValidUntil: string }).priceValidUntil;
    expect(until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days = (new Date(until).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(25);
    expect(days).toBeLessThan(35);
  });

  it("infererer brand fra produktnavn når brand mangler", () => {
    const s = buildProductSchema({
      ...product,
      brand: null,
      product_name: "Sovepose - Treklife Peak 4S - 4 sæsons",
      in_stock: true,
    });
    expect((s.brand as { name: string }).name).toBe("Treklife");
  });

  it("udelader brand når intet kendt brand findes i navnet", () => {
    // Var "Sovepose - Sleepline 250 - 2 sæsons". Sleepline ER et maerke i
    // kataloget og staar i MAERKER, saa rentMaerke() finder det nu, hvilket
    // er det rigtige. Her bruges i stedet en vare uden maerke nogen steder.
    const s = buildProductSchema({
      ...product,
      brand: null,
      product_name: "Dry bag - 8 liter",
      in_stock: true,
    });
    expect(s.brand).toBeUndefined();
  });
});

describe("buildProductSchema – Merchant listing-felter (Search Console)", () => {
  it("inkluderer description fra produktet (trunkeret)", () => {
    const s = buildProductSchema({ ...product, description: "En god sovepose til shelterture. ".repeat(50) });
    expect(typeof s.description).toBe("string");
    expect((s.description as string).length).toBeLessThanOrEqual(500);
  });

  it("udelader description når produktet ingen har", () => {
    const s = buildProductSchema({ ...product, description: null });
    expect(s.description).toBeUndefined();
  });

  it("sætter gtin13 når id'et indeholder et 13-cifret EAN (outmore)", () => {
    const s = buildProductSchema({ ...product, id: "outmore-5709388146854" });
    expect(s.gtin13).toBe("5709388146854");
  });

  it("udelader gtin når id'et ikke er et EAN (backpackerlife)", () => {
    const s = buildProductSchema({ ...product, id: "backpackerlife-72997" });
    expect(s.gtin13).toBeUndefined();
  });

  it("inkluderer shippingDetails når shipping_cost kendes", () => {
    const s = buildProductSchema({ ...product, shipping_cost: 0 });
    const off = s.offers as Record<string, unknown>;
    const sd = off.shippingDetails as Record<string, unknown>;
    expect(sd["@type"]).toBe("OfferShippingDetails");
    expect((sd.shippingRate as { value: number }).value).toBe(0);
  });

  it("udelader shippingDetails når shipping_cost er ukendt", () => {
    const s = buildProductSchema({ ...product, shipping_cost: null });
    const off = s.offers as Record<string, unknown>;
    expect(off.shippingDetails).toBeUndefined();
  });

  it("inkluderer hasMerchantReturnPolicy med forhandlerens returdage", () => {
    const bp = buildProductSchema({ ...product, retailer: "backpackerlife" });
    const om = buildProductSchema({ ...product, retailer: "outmore" });
    const bpPol = (bp.offers as Record<string, unknown>).hasMerchantReturnPolicy as { merchantReturnDays: number };
    const omPol = (om.offers as Record<string, unknown>).hasMerchantReturnPolicy as { merchantReturnDays: number };
    expect(bpPol.merchantReturnDays).toBe(100);
    expect(omPol.merchantReturnDays).toBe(14);
  });
});

describe("buildProductSchema – flere butikker", () => {
  const tilbud = [
    { retailer: "outdoornu", id: "outdoornu-1", price: 850, affiliate_url: "https://outdoornu/x" },
    { retailer: "prooutdoor", id: "prooutdoor-1", price: 959.95, affiliate_url: "https://prooutdoor/x" },
  ];

  it("annoncerer den laveste pris, ikke sidens egen butik", () => {
    // Produktsiden skriver "Laveste pris nu 850,00 kr." oeverst. Med et
    // enkelt Offer stod der 959,95 i skemaet, og det er en
    // prisuoverensstemmelse mod den synlige side.
    const s = buildProductSchema({ ...product, price: 959.95 }, { tilbud });
    const o = s.offers as { "@type": string; lowPrice: number; highPrice: number; offerCount: number };
    expect(o["@type"]).toBe("AggregateOffer");
    expect(o.lowPrice).toBe(850);
    expect(o.highPrice).toBe(959.95);
    expect(o.offerCount).toBe(2);
  });

  it("bliver ved et enkelt Offer, naar der kun er én butik", () => {
    const s = buildProductSchema(product, { tilbud: [tilbud[0]] });
    expect((s.offers as { "@type": string })["@type"]).toBe("Offer");
  });

  it("bliver ved et enkelt Offer, naar der ikke er oplyst tilbud", () => {
    const s = buildProductSchema(product);
    expect((s.offers as { "@type": string })["@type"]).toBe("Offer");
  });
});

describe("buildProductSchema – stregkode", () => {
  it("bruger feedets ean, naar den er en gyldig EAN13", () => {
    const s = buildProductSchema({ ...product, ean: "7318841251806" });
    expect(s.gtin13).toBe("7318841251806");
  });

  it("falder tilbage til Outmore-id'et, som selv ER en EAN13", () => {
    const s = buildProductSchema({ ...product, id: "outmore-5709388146854", ean: null });
    expect(s.gtin13).toBe("5709388146854");
  });

  it("udelader gtin13, naar stregkoden ikke er 13 cifre", () => {
    // prooutdoor skriver 12-cifrede UPC-numre: "887194014705" er 12 cifre.
    const s = buildProductSchema({ ...product, id: "prooutdoor-201-1008419", ean: "88719401470" });
    expect(s.gtin13).toBeUndefined();
  });
});

describe("buildProductSchema – UPC-A og kontrolciffer", () => {
  it("konverterer en 12-cifret UPC-A til EAN13 med et nul foran", () => {
    // Keen skriver UPC. 887194014705 er den rigtige kode paa Arroyo II, og
    // 0887194014705 er den samme vare som EAN13.
    const s = buildProductSchema({ ...product, ean: "887194014705" });
    expect(s.gtin13).toBe("0887194014705");
  });

  it("afviser en kode hvis kontrolciffer ikke passer", () => {
    // Et forkert gtin er vaerre end intet: Google matcher varen mod en anden.
    const s = buildProductSchema({ ...product, id: "backpackerlife-1", ean: "7318841251807" });
    expect(s.gtin13).toBeUndefined();
  });

  it("afviser en 12-cifret kode der ikke bliver gyldig med nullet", () => {
    // 123456789012 er faktisk en GYLDIG UPC-A (kontrolciffer 2), saa den
    // duer ikke som negativ proeve. Her er sidste ciffer forkert.
    const s = buildProductSchema({ ...product, id: "backpackerlife-1", ean: "123456789013" });
    expect(s.gtin13).toBeUndefined();
  });

  it("tager imod den gyldige UPC-A 123456789012", () => {
    const s = buildProductSchema({ ...product, ean: "123456789012" });
    expect(s.gtin13).toBe("0123456789012");
  });

  it("validerer ogsaa den kode der udledes af Outmore-id'et", () => {
    const god = buildProductSchema({ ...product, id: "outmore-5709388146854", ean: null });
    expect(god.gtin13).toBe("5709388146854");
    const daarlig = buildProductSchema({ ...product, id: "outmore-5709388146855", ean: null });
    expect(daarlig.gtin13).toBeUndefined();
  });
});

describe("buildProductSchema – én butik med flere varianter", () => {
  it("annoncerer den variant siden viser, ikke guidens egen raekke", () => {
    // Petzl Swift RL: guidens raekke er den hvide til 903,95, men samlTilbud
    // folder Outmores varianter sammen til den billigste der kan koebes,
    // Black/Orange til 799,95, og det er den siden skriver.
    const s = buildProductSchema(
      { ...product, id: "outmore-3342540840980", price: 903.95 },
      { tilbud: [{ retailer: "outmore", id: "outmore-3342540851917", price: 799.95, affiliate_url: "https://outmore/bo" }] }
    );
    const o = s.offers as { "@type": string; price: number; url: string };
    expect(o["@type"]).toBe("Offer");
    expect(o.price).toBe(799.95);
    expect(o.url).toBe("https://outmore/bo");
  });

  it("melder paa lager, naar den viste variant er en anden end den udsolgte raekke", () => {
    const s = buildProductSchema(
      { ...product, id: "outmore-a", price: 903.95, in_stock: false },
      { tilbud: [{ retailer: "outmore", id: "outmore-b", price: 799.95, affiliate_url: "https://outmore/b" }] }
    );
    expect((s.offers as { availability: string }).availability).toBe("https://schema.org/InStock");
  });

  it("beholder udsolgt, naar den viste raekke ER varen selv", () => {
    const s = buildProductSchema(
      { ...product, id: "outmore-a", price: 903.95, in_stock: false },
      { tilbud: [{ retailer: "outmore", id: "outmore-a", price: 903.95, affiliate_url: "https://outmore/a" }] }
    );
    expect((s.offers as { availability: string }).availability).toBe("https://schema.org/OutOfStock");
  });
});
