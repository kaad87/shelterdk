import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getFamilyShelters } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";

export const revalidate = 86400;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Hvilke shelters er bedst til familier med børn?",
    answer:
      "De bedste familieshelters har plads til mindst 4 personer, toilet, drikkevand og gerne bålplads. På denne side viser vi kun shelters der opfylder alle tre krav: mindst 4 pladser, toilet og vand.",
  },
  {
    question: "Hvad er den ideelle alder for børn på sheltertur?",
    answer:
      "Børn i alle aldre kan være med på sheltertur. De mindste (0-3 år) kræver ekstra planlægning omkring søvn og sikkerhed. Børn fra 4-5 år elsker typisk shelterliv, og større børn kan deltage aktivt i bål, madlavning og vandreture.",
  },
  {
    question: "Hvad skal man medbringe til sheltertur med børn?",
    answer:
      "Ud over normal shelterudstyr bør du medbringe: ekstra varmt tøj (børn fryser hurtigere), hovedlygte til hvert barn, spil og bøger til dårligt vejr, ekstra snacks, og førstehjælpsudstyr. Se vores pakkeliste for flere detaljer.",
  },
  {
    question: "Er det sikkert at overnatte i shelter med små børn?",
    answer:
      "Ja, shelters er generelt sikre overnatningssteder. Vær opmærksom på bålpladser (hold børn på afstand), vandløb i nærheden, og pak en evt. barnesikring til shelteråbningen. Vælg shelters med faciliteter for størst komfort.",
  },
  {
    question: "Kan man booke et familievenligt shelter?",
    answer:
      "Nogle familievenlige shelters kan bookes via udinaturen.dk eller book.naturstyrelsen.dk. Det giver tryghed i planlægningen, især i højsæsonen. Gratis shelters fungerer efter først-til-mølle-princippet.",
  },
];

const PAGE_TITLE = "Shelter til familier – børnevenlige shelters med faciliteter | ShelterDK";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find familievenlige shelters i Danmark med plads, toilet og vand. Shelters der er perfekte til overnatning med børn.",
  alternates: { canonical: "https://shelterdk.dk/shelter-til-familier" },
  openGraph: {
    title: PAGE_TITLE,
    description: "Familievenlige shelters med toilet, vand og plads til hele familien.",
    url: "/shelter-til-familier",
  },
};

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

export default async function ShelterTilFamilierPage() {
  const shelters = await getFamilyShelters(50);

  const regionCounts: Record<string, number> = {};
  for (const s of shelters) {
    const r = (s.region || "").trim();
    if (r && r !== "Danmark") regionCounts[r] = (regionCounts[r] || 0) + 1;
  }
  const regionBreakdown = Object.entries(regionCounts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Shelter til familier" },
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <span className="text-primary font-medium">Shelter til familier</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              Shelter til familier med børn
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Her finder du shelters med plads til hele familien. Alle shelters på denne side
              har mindst 4 pladser, toilet og drikkevand – de vigtigste faciliteter for en
              tryg og komfortabel overnatning med børn.
            </p>
          </header>

          {/* Stats */}
          <section className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{shelters.length}</p>
              <p className="text-xs text-primary/60 mt-1">Familieshelters</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">4+</p>
              <p className="text-xs text-primary/60 mt-1">Min. pladser</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">100%</p>
              <p className="text-xs text-primary/60 mt-1">Med toilet</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">100%</p>
              <p className="text-xs text-primary/60 mt-1">Med vand</p>
            </div>
          </section>

          {/* Region breakdown */}
          {regionBreakdown.length > 0 && (
            <section className="mb-10 rounded-xl border border-accent/15 bg-accent/[0.04] p-5">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">Fordelt på regioner</h2>
              <div className="flex flex-wrap gap-3">
                {regionBreakdown.map((r) => (
                  <Link
                    key={r.region}
                    href={`/danmark/${slugifySegment(r.region)}`}
                    className="text-sm bg-white text-primary font-medium px-3 py-1.5 rounded-full border border-primary/10 hover:border-accent/30 transition-colors"
                  >
                    {r.region}: {r.count} shelters
                  </Link>
                ))}
              </div>
            </section>
          )}

          {shelters.length > 0 && (
            <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
                <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                  <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    {shelters.length} familievenlig{shelters.length !== 1 ? "e shelters" : "t shelter"} · scroll for flere
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                    {shelters.map((shelter) => (
                      <ShelterCard
                        key={shelter.id}
                        shelter={shelter}
                        href={shelterHref(shelter.region ?? null, shelter.kommune ?? null, shelter.slug)}
                      />
                    ))}
                  </div>
                </div>
                <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0 mx-4 sm:mx-6 lg:mx-0">
                  <ShelterMap shelters={shelters} className="w-full h-full" />
                </div>
              </div>
            </section>
          )}

          <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
            <h2 className="font-serif text-xl font-bold text-primary">
              Sheltertur med børn – en guide
            </h2>
            <p>
              En overnatning i shelter er for mange familier den perfekte introduktion til friluftsliv.
              Børn elsker at sove under åben himmel, lave bål og udforske naturen. Med de rette
              faciliteter – toilet, vand og nok plads – bliver turen komfortabel for hele familien.
            </p>
            <p>
              Læs vores{" "}
              <Link href="/blog/shelter-med-boern" className="text-accent hover:underline">guide til sheltertur med børn</Link>{" "}
              for flere tips og tricks. Se også vores{" "}
              <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste</Link>{" "}
              så du har styr på udstyret.
            </p>

            <h2 className="font-serif text-xl font-bold text-primary">
              Tips til den gode familiesheltertur
            </h2>
            <ul>
              <li>Vælg et shelter med kort gåafstand fra parkeringspladsen</li>
              <li>Ankom tidligt i højsæsonen for at sikre plads</li>
              <li>Medbring aktiviteter: naturbingo, forstørrelsesglas, kardusspil</li>
              <li>Lav mad over bål – det er halve oplevelsen for børn</li>
              <li>Pak ekstra varmt tøj – nætterne kan være kolde</li>
            </ul>

            <p>
              Se også:{" "}
              <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
              {" · "}
              <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
              {" · "}
              <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
              {" · "}
              <Link href="/shelter-naer-vand" className="text-accent hover:underline">shelter nær vand</Link>
              {" · "}
              <Link href="/shelter-til-cykeltur" className="text-accent hover:underline">shelter til cykeltur</Link>
              {" · "}
              <Link href="/handicapvenlige-shelters" className="text-accent hover:underline">handicapvenlige shelters</Link>
              {" · "}
              <Link href="/shelter-med-strand" className="text-accent hover:underline">shelter ved strand</Link>
              {" · "}
              <Link href="/shelter-booking" className="text-accent hover:underline">book shelter</Link>
              {" · "}
              <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">regler for shelter</Link>
              {" · "}
              <Link href="/danmark" className="text-accent hover:underline">udforsk alle shelters i Danmark</Link>.
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål om sheltertur med familie
            </h2>
            <dl className="space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(FAQ_ITEMS)) }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
