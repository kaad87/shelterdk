import { describe, it, expect } from "vitest";
import {
  readOnsitePrice,
  nightsBetween,
  calculateOnsiteTotal,
  formatOnsitePrice,
  describeOnsitePayment,
} from "../onsite-price";
import { calculateFee } from "../stripe";

/**
 * Ejerens egen pris (fx MobilePay ved ankomst) må ALDRIG blive til en
 * Stripe-opkrævning. Ejeren af Legind Bjerge tager 50 kr pr. nat pr. person og
 * opkræver dem selv; platformen tager kun bookinggebyret på 25 kr.
 */
const LEGIND = {
  onsite_price_dkk: 50,
  onsite_price_basis: "per_person_per_night",
  onsite_payment_note: "MobilePay 356093",
};

describe("readOnsitePrice", () => {
  it("læser ejerens pris", () => {
    expect(readOnsitePrice(LEGIND)).toEqual({
      dkk: 50,
      basis: "per_person_per_night",
      note: "MobilePay 356093",
    });
  });

  it("returnerer null når ejeren ikke opkræver noget selv", () => {
    expect(readOnsitePrice({})).toBeNull();
    expect(readOnsitePrice({ onsite_price_dkk: 0 })).toBeNull();
    expect(readOnsitePrice({ onsite_price_dkk: null })).toBeNull();
  });

  it("falder tilbage til pr. person pr. nat ved ukendt basis", () => {
    expect(readOnsitePrice({ onsite_price_dkk: 50, onsite_price_basis: "vrøvl" })?.basis)
      .toBe("per_person_per_night");
  });
});

describe("nightsBetween", () => {
  it("tæller nætter, ikke dage", () => {
    expect(nightsBetween("2026-08-10", "2026-08-12")).toBe(2);
  });
  it("giver mindst 1 nat, så en endagsbooking ikke bliver gratis", () => {
    expect(nightsBetween("2026-08-10", "2026-08-10")).toBe(1);
  });
});

describe("calculateOnsiteTotal", () => {
  const p = readOnsitePrice(LEGIND)!;

  it("ganger med både personer og nætter", () => {
    // Lenes eget eksempel: 4 personer, 2 nætter = 400 kr
    expect(calculateOnsiteTotal(p, { guests: 4, nights: 2 })).toBe(400);
    expect(calculateOnsiteTotal(p, { guests: 1, nights: 1 })).toBe(50);
  });

  it("respekterer pr. nat og pr. booking", () => {
    const perNight = readOnsitePrice({ onsite_price_dkk: 100, onsite_price_basis: "per_night" })!;
    expect(calculateOnsiteTotal(perNight, { guests: 8, nights: 3 })).toBe(300);
    const perBooking = readOnsitePrice({ onsite_price_dkk: 200, onsite_price_basis: "per_booking" })!;
    expect(calculateOnsiteTotal(perBooking, { guests: 8, nights: 3 })).toBe(200);
  });

  it("beskytter mod 0 og negative værdier", () => {
    expect(calculateOnsiteTotal(p, { guests: 0, nights: 0 })).toBe(50);
  });
});

describe("tekst til gæsten", () => {
  const p = readOnsitePrice(LEGIND)!;

  it("angiver beløb, grundlag og betalingsmåde", () => {
    expect(formatOnsitePrice(p)).toBe("50 kr pr. person pr. nat");
    expect(describeOnsitePayment(p)).toBe(
      "50 kr pr. person pr. nat betales direkte til ejeren via MobilePay 356093."
    );
  });

  it("regner totalen ud når vi kender gæster og nætter", () => {
    const t = describeOnsitePayment(p, { guests: 4, nights: 2 });
    expect(t).toContain("4 personer");
    expect(t).toContain("2 nætter");
    expect(t).toContain("400 kr");
  });

  it("bøjer ental korrekt", () => {
    const t = describeOnsitePayment(p, { guests: 1, nights: 1 });
    expect(t).toContain("1 person i 1 nat");
    expect(t).not.toContain("1 personer");
  });

  it("siger 'på stedet' når der ikke er noget betalingsnummer", () => {
    const uden = readOnsitePrice({ onsite_price_dkk: 50 })!;
    expect(describeOnsitePayment(uden)).toContain("på stedet");
  });
});

describe("må ALDRIG påvirke Stripe-opkrævningen", () => {
  it("gæsten opkræves kun bookinggebyret, ikke ejerens pris", () => {
    // Legind Bjerge: shelter_price_dkk = 0, gebyr min 25.
    const fee = calculateFee(0, 0, 25);
    expect(fee.shelterDkk).toBe(0);
    expect(fee.platformDkk).toBe(25);
    expect(fee.totalDkk).toBe(25);
    // De 50 kr indgår ingen steder — de opkræves af ejeren.
    expect(fee.totalDkk).not.toBe(75);
  });
});
