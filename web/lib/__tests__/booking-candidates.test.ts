import { describe, expect, it } from "vitest";
import type { Shelter } from "@/types/shelter";
import {
  analyzeBookingCandidate,
  inferManualBookingUpdate,
} from "../booking-candidates";

function mk(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "shelter-1",
    title: "Test shelter",
    slug: "test-shelter",
    description: null,
    location: null,
    image_url: null,
    google_rating: null,
    google_user_ratings_total: null,
    booking_url: null,
    duplicate_of_shelter_id: null,
    ...overrides,
  } as Shelter;
}

describe("analyzeBookingCandidate", () => {
  it("finder direkte bookinglink i HTML-beskrivelse", () => {
    const candidate = analyzeBookingCandidate(
      mk({
        description:
          '<p>Shelteret kan bookes her: <a href="https://shelterbooking.skive.dk/sted/hostrup-strand/">Hostrup Strand</a></p>',
      })
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.suggestedBookingUrl).toBe(
      "https://shelterbooking.skive.dk/sted/hostrup-strand/"
    );
    expect(candidate?.positiveSignals).toContain("kan bookes");
  });

  it("ignorerer beskrivelser der siger at shelteret ikke kan bookes", () => {
    const candidate = analyzeBookingCandidate(
      mk({
        description:
          "<p>Kan ikke bookes. Først til mølle.</p>",
      })
    );

    expect(candidate).toBeNull();
  });

  it("finder sandsynlige manuelle bookingkandidater uden direkte link", () => {
    const candidate = analyzeBookingCandidate(
      mk({
        description:
          "<p>Reservation sker efter aftale og betaling via MobilePay.</p>",
      })
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.suggestedBookingUrl).toBeNull();
    expect(candidate?.positiveSignals).toEqual(
      expect.arrayContaining(["reservation", "mobilepay"])
    );
  });
});

describe("inferManualBookingUpdate", () => {
  it("mapper bookinglink til eksternt direkte bookbar shelter", () => {
    const update = inferManualBookingUpdate({
      bookingUrl: "https://book.naturstyrelsen.dk/sted/skibelund-shelterplads/",
      provider: null,
    });

    expect(update.booking_provider).toBe("naturstyrelsen");
    expect(update.booking_link_mode).toBe("external_direct");
    expect(update.booking_lookup_key).toBe("skibelund-shelterplads");
    expect(update.booking_confidence).toBe("manual");
  });
});
