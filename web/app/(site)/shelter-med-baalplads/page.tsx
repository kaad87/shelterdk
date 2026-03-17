import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithFirewood } from "@/lib/shelters-with-firewood";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";

const BAAL_FAQ: FaqItem[] = [
  { question: "Hvornår er der bålforbud i Danmark?", answer: "Bålforbud udstedes af lokale beredskaber i perioder med tørke og forhøjet brandfare, typisk om sommeren. Tjek altid Beredskabsstyrelsens hjemmeside eller lokal skiltning inden du tænder bål. Ved bålforbud må du heller ikke bruge gasblus eller engangsgrill i naturen." },
  { question: "Må man bruge egen brænde på shelterpladser?", answer: "Ja, du må gerne medbringe eget brænde. På mange Naturstyrelsen-pladser er der gratis brænde tilgængeligt, men det er ikke garanteret. Medbring altid lidt brænde eller briketter som backup, og saml aldrig levende træ fra skoven." },
  { question: "Er der bålplads ved alle shelters i Danmark?", answer: "Nej, ikke alle shelters har bålplads. Nogle pladser ligger i områder med brandfare eller særlige naturhensyn. På ShelterDK kan du filtrere efter shelters med bålplads, så du kun ser pladser hvor bål er muligt." },
  { question: "Hvordan slukker man et bål korrekt på shelterplads?", answer: "Lad bålet brænde helt ned til gløder, hæld rigelig vand på og rør rundt med en pind. Gentag til der ikke længere stiger damp op. Bålpladsen skal være kold at røre ved inden du forlader den. Lad aldrig et bål brænde uovervåget." },
  { question: "Kan man lave mad over bål på shelterpladser?", answer: "Ja, bålpladsen er perfekt til madlavning. Medbring en grillrist eller en trefod til at sætte en gryde over ilden. Snobrød, grillmad og one-pot-retter er klassikere. Se vores guide til mad over bål for inspiration og opskrifter." },
];

const PAGE_TITLE = "Shelter med bålplads i Danmark – shelters med bål | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark med bålplads. Se alle shelterpladser hvor du kan tænde bål og opleve naturovernatning med åben ild.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-baalplads" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Shelters med bålplads i Danmark – find overnatningspladser i naturen hvor du kan tænde bål.",
    url: "/shelter-med-baalplads",
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

export default async function ShelterMedBaalpladsPage() {
  const shelters = await getSheltersWithFirewood(200);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Søg shelters", href: "/soeg" }, { label: "Shelter med bålplads" }]} />
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
          <span className="text-primary font-medium">Shelter med bålplads</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med bålplads i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du shelters og overnatningspladser i naturen med bålplads. Oplev hyggen
            ved et bål og naturen på tæt hold – det bedste af dansk naturovernatning.
          </p>
        </header>

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} med bålplads · scroll for flere
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
            Vi finder ingen shelters med registreret bålplads endnu. Tjek den enkelte shelterside
            – mange pladser har bålplads beskrevet i teksten. Du kan også{" "}
            <Link href="/soeg" className="text-accent hover:underline">
              søge alle shelters
            </Link>
            .
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Bålplads på shelterture
          </h2>
          <p>
            En bålplads er for mange en uundværlig del af oplevelsen ved naturovernatning. Mange
            shelterpladser i Danmark har en bålplads eller bålring – enten som del af en shelter­gruppe
            eller som et separat samlingssted. Bålet skaber varme, hygge og mulighed for madlavning
            over åben ild. På ShelterDK viser vi de shelters hvor det fremgår af data at der er
            bålplads på eller tæt ved pladsen.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Regler for bål i naturen
          </h2>
          <p>
            Husk altid at følge de gældende regler for bål i Danmark. I perioder med tørke eller
            forhøjet brandfare kan der være bålforbud i skove og naturområder – tjek altid
            Beredskabsstyrelsens aktuelle regler og lokal skiltning inden du tænder bål. Brug altid
            den opstillede bålplads og hav vand klar til at slukke bålet, inden du forlader pladsen.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find shelter med bålplads i hele Danmark
          </h2>
          <p>
            Udforsk shelters med bålplads i{" "}
            <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>,{" "}
            <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link>,{" "}
            <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjælland</Link>{" "}
            og på Bornholm. Klik på et shelter for at se om der er bålplads, billeder og
            bookingmuligheder.
          </p>

          <p>
            Se også:{" "}
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">
              shelter med toilet
            </Link>
            {" · "}
            <Link href="/shelter-med-vand" className="text-accent hover:underline">
              shelter med vand
            </Link>
            {" · "}
            <Link href="/shelter-med-hund" className="text-accent hover:underline">
              hundevenlige shelters
            </Link>
            {" · "}
            <Link href="/soeg" className="text-accent hover:underline">
              søg alle shelters
            </Link>
            .
          </p>
        </section>

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Ofte stillede spørgsmål om shelters med bålplads
          </h2>
          <dl className="space-y-6">
            {BAAL_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(BAAL_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
