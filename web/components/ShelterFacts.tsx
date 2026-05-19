import type { Shelter } from "@/types/shelter";
import {
  getToilet,
  getWater,
  getCapacity,
  getLocationCoords,
} from "@/lib/shelter-detail";

interface ShelterFactsProps {
  shelter: Shelter;
  coords?: { lat: number; lon: number } | null;
  firewood?: boolean | null;
  hasShelterDkBooking?: boolean;
}

function toiletLabel(
  toilet: "flush" | "mulch" | "none" | "unknown" | null
): string | null {
  switch (toilet) {
    case "flush": return "Vandskyllende toilet (ja)";
    case "mulch": return "Muldtoilet (medbring papir)";
    case "none": return "Ingen toilet på pladsen";
    case "unknown": return "Toiletstatus ikke oplyst";
    default: return null;
  }
}

function waterLabel(water: boolean | null): string {
  if (water === true) return "Ja (vandhane eller drikkevand)";
  if (water === false) return "Nej (medbring vand)";
  return "Ikke oplyst";
}

function firewoodLabel(firewood: boolean | null | undefined): string {
  if (firewood === true) return "Ja";
  if (firewood === false) return "Nej";
  return "Ikke oplyst";
}

export function ShelterFacts({
  shelter,
  coords,
  firewood = null,
  hasShelterDkBooking = false,
}: ShelterFactsProps) {
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const capacity = getCapacity(shelter);
  const gps = coords ?? getLocationCoords(shelter);
  const bookingUrl = (shelter.booking_url || "").trim();
  const hasExternalBookingLink = Boolean(bookingUrl && /^https?:\/\//i.test(bookingUrl));

  const items: { term: string; definition: string }[] = [];

  const toiletText = toiletLabel(toilet);
  if (toiletText) items.push({ term: "Toilet", definition: toiletText });
  items.push({ term: "Vand", definition: waterLabel(water) });
  items.push({ term: "Bålplads", definition: firewoodLabel(firewood) });

  if (capacity != null) {
    items.push({ term: "Antal pladser", definition: `${capacity} personer` });
  }

  let bookingDefinition: string;
  if (hasShelterDkBooking) {
    bookingDefinition = "Bookbart via ShelterDK";
  } else if (hasExternalBookingLink) {
    bookingDefinition = "Direkte link til booking (se nedenfor)";
  } else {
    bookingDefinition = "Første til mølle (ingen reservation)";
  }
  items.push({ term: "Booking", definition: bookingDefinition });

  if (gps) {
    items.push({
      term: "GPS",
      definition: `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`,
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
      {hasExternalBookingLink && (
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
