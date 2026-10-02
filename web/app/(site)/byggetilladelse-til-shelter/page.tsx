import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { faqToJsonLd } from "@/lib/faq";
import { getSitePageModified } from "@/lib/content-dates";

/**
 * /byggetilladelse-til-shelter — udskilt fra /koeb-shelter.
 *
 * Search Console (28 dage, sep. 2026): regel- og tilladelses-queries stod for
 * 807 visninger på /koeb-shelter med NUL klik ved plads 10,5 ("skal man søge
 * byggetilladelse til shelter", "shelter afstand til skel", "må man bygge
 * shelter i haven"). De trak købssidens CTR ned uden selv at kunne tjene.
 *
 * Spørgsmåls-queries konverterer 7× dårligere end andre ved samme position
 * (0,5% mod 3,4% ved plads 5-7), fordi svaret gives i resultatsiden. Siden er
 * derfor bygget til at BLIVE det citerede svar: konklusionen først, konkrete
 * tal, og kilden navngivet — frem for at jagte et klik der sjældent kommer.
 */
export const revalidate = 86400;

const BR_URL =
  "https://www.bygningsreglementet.dk/administrative-bestemmelser/brv/sekundaer-bebyggelse/2_0_hvor_meget_maa_man_bygge/";

const FAQ = [
  {
    question: "Skal man søge byggetilladelse til et shelter?",
    answer:
      "Nej, ikke i de fleste tilfælde. Et shelter regnes som sekundær bebyggelse, og på en grund med enfamiliehus må du opføre op til 50 m² sekundær bebyggelse i alt uden byggetilladelse. Et typisk shelter fylder 5-10 m². Du skal stadig overholde reglerne om afstand til skel, placering på terræn og at det ikke må bruges til beboelse — og lokalplanen kan stille strengere krav.",
  },
  {
    question: "Hvor tæt på skel må et shelter stå?",
    answer:
      "Mindst 2,5 meter fra skel, medmindre andet er aftalt med naboen eller fremgår af lokalplanen for dit område.",
  },
  {
    question: "Tæller shelteret med i de 50 m²?",
    answer:
      "Ja. De 50 m² er det samlede areal af al sekundær bebyggelse på grunden — carport, skur, drivhus, overdækket terrasse og shelter tilsammen. Har du allerede en carport på 30 m² og et skur på 12 m², er der kun 8 m² tilbage.",
  },
  {
    question: "Må man bo i et shelter i haven?",
    answer:
      "Nej. Sekundær bebyggelse må ikke bruges til beboelse. At overnatte i det i ny og næ er noget andet end at bo der, men shelteret må ikke indrettes eller bruges som bolig.",
  },
  {
    question: "Gælder de samme regler i landzone?",
    answer:
      "Nej. Ligger grunden i landzone, tæt på strand, fortidsminder eller beskyttet natur, gælder der helt andre regler, og du kan have brug for landzonetilladelse eller dispensation. Ring til teknisk forvaltning i din kommune inden du går i gang.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "Byggetilladelse til shelter: skal du søge? (2026) | ShelterDK",
  },
  description:
    "Nej — op til 50 m² sekundær bebyggelse kræver ikke byggetilladelse på en grund med enfamiliehus. Se de tre betingelser: 2,5 m til skel, på terræn, ikke beboelse — og hvornår lokalplan og landzone ændrer billedet.",
  alternates: { canonical: "https://shelterdk.dk/byggetilladelse-til-shelter" },
  openGraph: {
    title: "Byggetilladelse til shelter: skal du søge?",
    description:
      "Reglerne for shelter i haven: 50 m²-grænsen, 2,5 meter til skel, placering på terræn og hvornår lokalplanen vejer tungere.",
    url: "/byggetilladelse-til-shelter",
  },
};

const BETINGELSER = [
  ["Afstand til skel", "Mindst 2,5 meter, medmindre andet er aftalt med naboen eller fremgår af lokalplanen."],
  ["Placering på terræn", "Bygningen skal stå på jorden — ikke hæves på sokkel eller graves ned."],
  ["Ikke til beboelse", "Sekundær bebyggelse må ikke bruges som bolig. Overnatning i ny og næ er noget andet end at bo der."],
];

export default function ByggetilladelsePage() {
  const lastVerified = getSitePageModified("/byggetilladelse-til-shelter");
  const faqJsonLd = JSON.stringify(faqToJsonLd(FAQ));

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Køb shelter", href: "/koeb-shelter" },
          { label: "Byggetilladelse" },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/koeb-shelter" className="py-1 -my-1 hover:text-accent transition-colors">Køb shelter</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <span className="text-primary font-medium">Byggetilladelse</span>
          </nav>

          <header className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              Byggetilladelse til shelter: skal du søge?
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Kort svar: <strong>nej, i de fleste tilfælde ikke.</strong> Et shelter regnes som
              sekundær bebyggelse, og den må fylde op til 50 m² på en grund med enfamiliehus uden
              tilladelse. Tre betingelser skal være opfyldt — og lokalplanen kan ændre billedet.
            </p>
            <div className="mt-4">
              <LastVerifiedBadge isoDate={lastVerified} />
            </div>
          </header>

          <QuickAnswer
            url="https://shelterdk.dk/byggetilladelse-til-shelter"
            heading="Hurtigt svar om byggetilladelse til shelter"
            answer="Et shelter kræver normalt ikke byggetilladelse. Det regnes som sekundær bebyggelse, og på en grund med enfamiliehus må du opføre op til 50 m² sekundær bebyggelse i alt uden at søge. Et typisk shelter fylder 5-10 m². Betingelserne er: mindst 2,5 meter til skel, bygningen skal stå på terræn, og den må ikke bruges til beboelse. Lokalplanen for dit område kan stille strengere krav, og i landzone eller nær strand, fortidsminder og beskyttet natur gælder andre regler."
            questionHint="Siden besvarer spørgsmål som “skal man søge byggetilladelse til shelter”, “hvor tæt på skel må et shelter stå” og “må man bygge shelter i haven”."
            dateModified={lastVerified}
          />

          <section className="my-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-4">De 50 m² — hvad tæller med?</h2>
            <p className="text-primary/85 leading-relaxed mb-4">
              Et shelter er <em>sekundær bebyggelse</em> i bygningsreglementet, på linje med skure,
              carporte, drivhuse og overdækkede terrasser. På en grund med enfamiliehus må du opføre
              op til <strong>50 m² sekundær bebyggelse i alt</strong> uden byggetilladelse.
            </p>
            <p className="text-primary/85 leading-relaxed mb-4">
              Det er det <strong>samlede</strong> areal på grunden der tæller. Har du en carport på
              30 m² og et skur på 12 m², er der 8 m² tilbage — og så kan selv et lille shelter på
              10 m² kræve tilladelse. Et typisk shelter fylder 5-10 m², så arealet er sjældent
              forhindringen, men du skal lægge det hele sammen først.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-4">De tre betingelser</h2>
            <ul className="space-y-3 text-primary/85">
              {BETINGELSER.map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <span className="text-accent" aria-hidden>•</span>
                  <span><strong>{k}:</strong> {v}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-10 rounded-xl border border-primary/15 bg-primary/[0.03] p-5">
            <h2 className="font-serif text-xl font-bold text-primary mb-3">Når reglerne alligevel er strengere</h2>
            <p className="text-sm text-primary/80 leading-relaxed">
              Lokalplanen for dit område kan stille strengere krav end bygningsreglementet — fx om
              placering, højde eller materialer. Og ligger grunden i landzone, tæt på strand,
              fortidsminder eller beskyttet natur, gælder der helt andre regler. Ring til teknisk
              forvaltning i din kommune inden du går i gang; det tager ti minutter og kan spare dig
              for at skulle rive det ned igen.
            </p>
            <p className="mt-3 text-sm">
              <a
                href={BR_URL}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Reglerne i Bygningsreglementet (sekundær bebyggelse)
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">Ofte stillede spørgsmål</h2>
            <dl className="space-y-6">
              {FAQ.map((f) => (
                <div key={f.question}>
                  <dt className="font-semibold text-primary">{f.question}</dt>
                  <dd className="mt-1 text-primary/85 leading-relaxed">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-primary/10 p-6">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Næste skridt</h2>
            <p className="text-primary/85">
              Har du styr på reglerne, kan du se{" "}
              <Link href="/koeb-shelter" className="text-accent hover:underline">hvad et shelter koster og hvor du køber det</Link>,
              eller bygge selv efter{" "}
              <Link href="/koeb-shelter#byg-selv" className="text-accent hover:underline">Naturstyrelsens gratis tegninger</Link>.
              Vil du hellere prøve det af først, så find et{" "}
              <Link href="/" className="text-accent hover:underline">shelter i naturen</Link>{" "}
              — reglerne dér står i{" "}
              <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">guiden om shelter og teltning</Link>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
