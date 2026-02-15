import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getSheltersWithWater } from "@/lib/shelters-with-water";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";

export const metadata: Metadata = {
  title: "Shelter med vand i Danmark – drikkevand og vandhane",
  description:
    "Find shelters og overnatningspladser i Danmark hvor der er vand – vandhane eller drikkevand. Udforsk pladser med adgang til vand til naturovernatning.",
  openGraph: {
    title: "Shelter med vand i Danmark | ShelterDK",
    description:
      "Shelters med vand – vandhane eller drikkevand. Find overnatningspladser i naturen med adgang til vand.",
  },
};

function shelterHref(
  region: string | null,
  kommune: string | null,
  slug: string
): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") {
    return `/shelter/${slug}`;
  }
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

export default async function ShelterMedVandPage() {
  const shelters = await getSheltersWithWater(200);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link
            href="/"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Hjem
          </Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <Link
            href="/soeg"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Søg shelters
          </Link>
          <ChevronRight size={14} className="text-primary/50" />
          <span className="text-primary font-medium">Shelter med vand</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med vand i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du overnatningspladser i naturen hvor der er vand – enten vandhane eller
            adgang til drikkevand. Perfekt til dig der vil have vand tæt på uden at medbringe alt.
          </p>
        </header>

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} med vand · scroll for flere
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                  {shelters.map((shelter) => (
                    <ShelterCard
                      key={shelter.id}
                      shelter={shelter}
                      href={shelterHref(
                        shelter.region ?? null,
                        shelter.kommune ?? null,
                        shelter.slug
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0 mx-4 sm:mx-6 lg:mx-0">
                <ShelterMap shelters={shelters} className="w-full h-full" />
              </div>
            </div>
          </section>
        ) : null}

        {shelters.length === 0 && (
          <p className="text-primary/70 py-8">
            Vi finder ingen shelters med registreret vand endnu. Prøv at kigge i{" "}
            <Link href="/soeg" className="text-accent hover:underline">
              søgningen
            </Link>{" "}
            eller tjek den enkelte shelterside – mange pladser har vand beskrevet i teksten.
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Hvorfor vælge shelter med vand?
          </h2>
          <p>
            Adgang til vand gør shelterovernatning nemmere – til madlavning, opvask og drikkevand.
            Mange shelters i Danmark har vandhane eller anden adgang til vand registreret i
            GeoFA og Naturstyrelsens data. På pladser uden vand skal du medbringe alt vand eller
            have mulighed for at hente det i nærheden. Her finder du shelters hvor vi ved der er
            vand på eller tæt ved pladsen.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Vandhane og drikkevand på shelterpladser
          </h2>
          <p>
            Vand på shelterpladser kan være en vandhane ved toilet eller ved et servicehus, eller
            det kan være drikkevand fra en pumpe eller kran. Tjek altid på den enkelte plads om
            vandet er drikkbart – nogle steder er det kun til opvask. På ShelterDK viser vi
            pladser hvor vand er angivet i de offentlige datakilder, så du nemt kan finde
            shelters med denne facilitet.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find shelter med vand i hele Danmark
          </h2>
          <p>
            Udforsk shelters med vand i Jylland, på Fyn, Sjælland og på Bornholm. Klik på et
            shelter for at se mere information og præcis hvad der findes på pladsen. Mange
            shelters kan bookes på forhånd via udinaturen.dk eller Naturstyrelsen.
          </p>
        </section>
      </div>
    </div>
  );
}
