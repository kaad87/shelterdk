import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithPets } from "@/lib/shelters-with-pets";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";

const PAGE_TITLE = "Shelter med hund i Danmark – tag hunden med på tur | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark hvor hunde er tilladt. Se alle shelterpladser der er hundevenlige og tag hunden med på naturovernatning.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-hund" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Hundevenlige shelters i Danmark – find overnatningspladser hvor du må have hund med.",
    url: "/shelter-med-hund",
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

export default async function ShelterMedHundPage() {
  const shelters = await getSheltersWithPets(200);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Søg shelters", href: "/soeg" }, { label: "Shelter med hund" }]} />
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
          <span className="text-primary font-medium">Shelter med hund</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med hund i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du shelters og overnatningspladser i naturen hvor hunde er tilladt.
            Tag hunden med på tur og oplev naturovernatning i Danmark.
          </p>
        </header>

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} hundevenlig{shelters.length !== 1 ? "e shelters" : " shelter"} · scroll for flere
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
            Vi finder ingen shelters med registreret hundetilladelse endnu. Tjek den enkelte
            shelterside – mange pladser tillader hunde og beskriver det i teksten. Du kan også{" "}
            <Link href="/soeg" className="text-accent hover:underline">
              søge alle shelters
            </Link>
            .
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Tag hunden med på sheltertur
          </h2>
          <p>
            Mange shelters i Danmark er hundevenlige – men det er ikke alle pladser der tillader hunde.
            Det skyldes typisk hensyn til vildtet i området, dyreliv eller regler for den pågældende
            skov eller naturpark. På ShelterDK viser vi de pladser hvor det fremgår af de offentlige
            data at hunde er tilladt, så du kan planlægge turen i god ro.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Regler for hunde på shelterpladser
          </h2>
          <p>
            Selvom hunde er tilladt på en shelterplads, gælder Danmarks generelle regler for hunde
            i naturen: hunde skal som udgangspunkt føres i snor i skove og naturområder fra 1. april
            til 30. september. Udenfor disse måneder er der friere regler, men tjek altid lokal
            skiltning. Hav altid vand med til din hund, og respekter andre overnatningsgæsters
            plads og frihed.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find hundevenlig shelter i hele Danmark
          </h2>
          <p>
            Udforsk hundevenlige shelters i{" "}
            <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>,{" "}
            <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link>,{" "}
            <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjælland</Link>{" "}
            og på Bornholm. Klik på et shelter for at se detaljeret info om faciliteter og
            bookingmuligheder.
          </p>

          <p>
            Leder du efter andre faciliteter? Se{" "}
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">
              shelter med toilet
            </Link>
            {" "}eller{" "}
            <Link href="/shelter-med-vand" className="text-accent hover:underline">
              shelter med vand
            </Link>
            {" "}– eller{" "}
            <Link href="/soeg" className="text-accent hover:underline">
              søg alle shelters
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
