import { describe, it, expect } from "vitest";
import { getShelterFaqItems } from "@/lib/faq";

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
