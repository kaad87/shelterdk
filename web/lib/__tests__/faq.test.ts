import { describe, it, expect } from "vitest";
import { faqAnswerText, faqToJsonLd, FAQ_LINK_RE, getShelterFaqItems } from "@/lib/faq";

function bookingAnswer(opts: Parameters<typeof getShelterFaqItems>[1]): string {
  const items = getShelterFaqItems("Testshelter", opts);
  const booking = items.find((i) => i.question.startsWith("Kan man booke"));
  return booking?.answer ?? "";
}

const base: { toilet: "flush" | "mulch" | "none" | "unknown" | null; petsAllowed: boolean | null } = {
  toilet: null,
  petsAllowed: null,
};
// Positiv ShelterDK-påstand (må IKKE optræde for ikke-ShelterDK-shelters).
// Bemærk: "ikke direkte på ShelterDK" indeholder "direkte på ShelterDK", så
// vi matcher bevidst kun den positive formulering "kan bookes direkte på...".
const SHELTERDK_CLAIM = /kan bookes direkte på ShelterDK/i;

describe("getShelterFaqItems – booking-svar", () => {
  it("ShelterDK-booking → 'direkte på ShelterDK'", () => {
    const a = bookingAnswer({ ...base, bookable: true, bookingUrl: null, hasShelterDkBooking: true });
    expect(a).toMatch(/direkte på ShelterDK/i);
  });

  it("bookbar med ekstern URL → 'via linket', IKKE ShelterDK", () => {
    const a = bookingAnswer({ ...base, bookable: true, bookingUrl: "https://udinaturen.dk/x", hasShelterDkBooking: false });
    expect(a).toMatch(/via linket/i);
    expect(a).not.toMatch(SHELTERDK_CLAIM);
  });

  it("bookbar uden URL og IKKE ShelterDK → må IKKE påstå ShelterDK", () => {
    const a = bookingAnswer({ ...base, bookable: true, bookingUrl: null, hasShelterDkBooking: false });
    expect(a).not.toMatch(SHELTERDK_CLAIM);
    expect(a).toMatch(/ikke (direkte )?(på )?ShelterDK|forvalter|kontakt/i);
  });

  it("Naturstyrelsen-hint → nævner Naturstyrelsen/udinaturen, ikke ShelterDK", () => {
    const a = bookingAnswer({ ...base, bookable: true, bookingUrl: null, hasShelterDkBooking: false, bookingHint: "naturstyrelsen" });
    expect(a).not.toMatch(SHELTERDK_CLAIM);
    expect(a).toMatch(/Naturstyrelsen|udinaturen/i);
  });

  it("ikke bookbar → først-til-mølle", () => {
    const a = bookingAnswer({ ...base, bookable: false, bookingUrl: null, hasShelterDkBooking: false });
    expect(a).toMatch(/først-til-mølle|kan ikke bookes/i);
  });
});

describe("faqAnswerText", () => {
  it("folder et markdown-link ned til sin label", () => {
    expect(faqAnswerText("Se vores [regnbukser](/bedste/regntoj) her.")).toBe(
      "Se vores regnbukser her."
    );
  });

  it("tager alle links i samme svar, ikke kun det foerste", () => {
    expect(
      faqAnswerText("[et](/a) og [to](/b) og [tre](https://ekstern.dk/c)")
    ).toBe("et og to og tre");
  });

  it("lader et svar uden links staa uroert", () => {
    const a = "R-værdi måler isolering mod kulde fra jorden — jo højere, jo varmere.";
    expect(faqAnswerText(a)).toBe(a);
  });

  it("rammer ikke en skarp parentes, der ikke er et link", () => {
    const a = "Vælg R 3-4 (tre sæsoner) til shelter [se tabellen].";
    expect(faqAnswerText(a)).toBe(a);
  });
});

describe("faqToJsonLd", () => {
  it("giver Google teksten og ikke linksyntaksen", () => {
    const json = faqToJsonLd([
      { question: "Hvad med regn?", answer: "Se [regnbukser](/bedste/regntoj)." },
    ]) as { mainEntity: { acceptedAnswer: { text: string } }[] };
    expect(json.mainEntity[0].acceptedAnswer.text).toBe("Se regnbukser.");
  });
});

describe("FAQ_LINK_RE", () => {
  // Visningen laver sin egen /g-kopi af kilden. Uden lastIndex-nulstilling
  // ville et delt /g-regex springe det foerste link over i hvert andet svar,
  // saa testen her fastholder at moensteret IKKE er globalt.
  it("er ikke globalt, saa det kan deles mellem visning og schema", () => {
    expect(FAQ_LINK_RE.global).toBe(false);
  });
});
