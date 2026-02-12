import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Leaf, Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "Om os",
  description:
    "ShelterDK samler shelters i hele Danmark – GeoFA, Naturstyrelsen, Book en Shelter og mere. Find overnatning i naturen på ét kort.",
};

export default function OmOsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <h1 className="font-serif text-4xl font-bold text-primary mb-8">
          Om ShelterDK
        </h1>

        <p className="text-primary/90 text-lg leading-relaxed mb-8">
          ShelterDK er et lille projekt der samler shelters fra hele Danmark på
          ét sted. Vi kobler data fra GeoFA, Naturstyrelsen, Book en Shelter og
          andre kilder – så du kan finde overnatningspladser i naturen med
          billeder, anmeldelser og praktisk info.
        </p>

        <div className="space-y-8 mb-12">
          <div className="flex gap-4">
            <div className="rounded-full bg-accent/20 p-3 h-fit shrink-0">
              <Compass className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-primary mb-2">
                Ét samlet kort
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Udforsk shelters på kort eller liste. Filtrér på region, billede,
                anmeldelser og om shelteren kan bookes.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="rounded-full bg-accent/20 p-3 h-fit shrink-0">
              <Leaf className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-primary mb-2">
                Naturovernatning
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Shelter, bålpladser og teltpladser i naturen – til dem der vil
                uden dør næste gang.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="rounded-full bg-accent/20 p-3 h-fit shrink-0">
              <MapPin className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-primary mb-2">
                Åbne data
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Vi bygger på GeoFA og andre offentlige kilder. Billeder og
                anmeldelser komplementerer dataene, så du kan træffe et godt
                valg.
              </p>
            </div>
          </div>
        </div>

        <p className="text-primary/70 text-sm">
          Har du spørgsmål eller forslag? Skriv til os via{" "}
          <Link href="/kontakt" className="text-accent hover:underline">
            kontakt
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
