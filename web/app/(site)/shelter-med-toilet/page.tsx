import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getSheltersWithToilet } from "@/lib/shelters-with-toilet";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { getToilet } from "@/lib/shelter-detail";

const PAGE_TITLE = "Shelter med toilet i Danmark – vandskyllende og muldtoilet | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark hvor der er toilet – vandskyllende toilet eller muldtoilet. Udforsk pladser med faciliteter til naturovernatning.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-toilet" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Shelters med toilet – vandskyllende eller muldtoilet. Find overnatningspladser i naturen med faciliteter.",
    url: "/shelter-med-toilet",
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

const TOILET_LABELS: Record<string, string> = {
  flush: "Vandskyllende toilet",
  mulch: "Muldtoilet / tørkloset",
};

export default async function ShelterMedToiletPage() {
  const shelters = await getSheltersWithToilet(200);

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
          <span className="text-primary font-medium">Shelter med toilet</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med toilet i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du overnatningspladser i naturen hvor der er toilet – enten vandskyllende
            toilet eller muldtoilet/tørkloset. Perfekt til dig der vil have faciliteter tæt på.
          </p>
        </header>

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} med toilet · scroll for flere
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                  {shelters.map((shelter) => {
                    const toiletType = getToilet(shelter);
                    const toiletLabel =
                      toiletType && toiletType !== "unknown" && toiletType !== "none"
                        ? TOILET_LABELS[toiletType] ?? toiletType
                        : null;

                    return (
                      <div key={shelter.id} className="relative">
                        <ShelterCard
                          shelter={shelter}
                          href={shelterHref(
                            shelter.region ?? null,
                            shelter.kommune ?? null,
                            shelter.slug
                          )}
                        />
                        {toiletLabel && (
                          <p className="mt-2 text-xs font-medium text-accent">
                            {toiletLabel}
                          </p>
                        )}
                      </div>
                    );
                  })}
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
            Vi finder ingen shelters med registreret toilet endnu. Prøv at kigge i{" "}
            <Link href="/soeg" className="text-accent hover:underline">
              søgningen
            </Link>{" "}
            eller tjek den enkelte shelterside – mange pladser har toilet beskrevet i teksten.
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Hvorfor vælge shelter med toilet?
          </h2>
          <p>
            Når du overnatter i naturen, betyder det meget om der er toilet på pladsen. Mange
            shelters i Danmark har enten vandskyllende toilet eller muldtoilet – også kaldet
            tørklosetter. Et muldtoilet er et primitivt, men hyppigt toilet på shelterpladser. Det
            bruger naturlig nedbrydning og passer godt til pladser uden ledningsvand. Vandskyllende
            toilet findes typisk ved større centre eller pladser med tilknytning til bebyggelse.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Muldtoilet og tørklosetter på shelters
          </h2>
          <p>
            Muldtoilet og tørklosetter er de mest almindelige toiletter på shelterpladser i
            Danmark. De kræver ikke vand og passer derfor godt til naturovernatning. Selvom de er
            enklere end et almindeligt toilet, giver de en vigtig facilitet – især for familier med
            børn eller dem der foretrækker ikke at skulle finde et skjult sted i skoven. På
            ShelterDK markerer vi shelters hvor vi ved der er toilet, så du nemt kan finde pladser
            med denne facilitet.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find shelter med toilet i hele Danmark
          </h2>
          <p>
            Udforsk shelters med toilet i Jylland, på Fyn, Sjælland og på Bornholm. Klik på et
            shelter for at se mere information, billeder og præcis hvilken toilettype der findes på
            pladsen. Mange shelters kan bookes på forhånd via udinaturen.dk eller Naturstyrelsen.
          </p>
        </section>
      </div>
    </div>
  );
}
