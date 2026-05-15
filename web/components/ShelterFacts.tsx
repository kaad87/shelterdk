import type { Shelter } from "@/types/shelter";
import {
  getToilet,
  getWater,
  getCapacity,
  getLocationCoords,
  isBookable,
} from "@/lib/shelter-detail";

interface ShelterFactsProps {
  shelter: Shelter;
  /** GPS-koordinater (hvis allerede beregnet på siden). */
  coords?: { lat: number; lon: number } | null;
  /** Bålplads – når data findes (fx fra geofa_raw). Ellers vises "Ikke oplyst". */
  firewood?: boolean | null;
}

/** Præcis toilet-tekst – undgår "Maybe", giver konkret besked til LLMs. */
function toiletLabel(
  toilet: "flush" | "mulch" | "none" | "unknown" | null
): string | null {
  switch (toilet) {
    case "flush":
      return "Vandskyllende toilet (ja)";
    case "mulch":
      return "Muldtoilet (medbring papir)";
    case "none":
      return "Ingen toilet på pladsen (medbring spade eller brug offentlige toiletter i nærheden)";
    case "unknown":
      return "Toiletstatus ikke oplyst – tjek beskrivelsen eller kontakt forvalter";
    default:
      return null;
  }
}

/** Præcis vand-tekst. */
function waterLabel(water: boolean | null): string {
  if (water === true) return "Ja (vandhane eller drikkevand)";
  if (water === false) return "Nej (medbring vand)";
  return "Ikke oplyst (tjek beskrivelsen eller kontakt forvalter)";
}

/** Præcis bålplads-tekst. */
function firewoodLabel(firewood: boolean | null | undefined): string {
  if (firewood === true) return "Ja";
  if (firewood === false) return "Nej";
  return "Ikke oplyst (tjek beskrivelsen eller kontakt forvalter)";
}

export function ShelterFacts({ shelter, coords, firewood = null }: ShelterFactsProps) {
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const capacity = getCapacity(shelter);
  const gps = coords ?? getLocationCoords(shelter);
  const bookable = isBookable(shelter);
  const bookingUrl = (shelter.booking_url || "").trim();

  const items: { term: string; definition: string }[] = [];

  // Faciliteter
  const toiletText = toiletLabel(toilet);
  if (toiletText) items.push({ term: "Toilet", definition: toiletText });
  items.push({ term: "Vand", definition: waterLabel(water) });
  items.push({ term: "Bålplads", definition: firewoodLabel(firewood) });

  if (capacity != null) {
    items.push({
      term: "Antal pladser",
      definition: `${capacity} personer`,
    });
  }

  const hasBookingLink = bookable && bookingUrl && /^https?:\/\//i.test(bookingUrl);
  if (hasBookingLink) {
    items.push({
      term: "Booking",
      definition: "Direkte link til booking (se nedenfor)",
    });
  } else if (bookable) {
    items.push({
      term: "Booking",
      definition: "Bookbart via ShelterDK",
    });
  } else {
    items.push({
      term: "Booking",
      definition: "Først til mølle (ingen reservation)",
    });
  }

  if (gps) {
    const latLon = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
    items.push({
      term: "GPS",
      definition: latLon,
    });
  }

  if (items.length === 0) return null;

  return (
    <dl className="space-y-3 text-primary/90">
      {items.map(({ term, definition }) => (
        <div key={term}>
          <dt className="font-semibold text-primary text-sm">{term}</dt>
          <dd className="mt-0.5 text-sm text-primary/80">{definition}</dd>
        </div>
      ))}
      {hasBookingLink && (
        <div>
          <dt className="font-semibold text-primary text-sm">Direkte link til booking</dt>
          <dd className="mt-0.5">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline text-sm break-all"
            >
              {bookingUrl}
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}
