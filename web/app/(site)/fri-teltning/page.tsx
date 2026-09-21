import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { AdBanner } from "@/components/AdBanner";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { FriTeltningMapClient } from "@/components/FriTeltningMapClient";
import { faqToJsonLd } from "@/lib/faq";
import { getSitePageModified } from "@/lib/content-dates";
import { loadFriTeltningIndex, groupByRegion, formatHa, summarize } from "@/lib/fri-teltning";
import { canonicalRegionSlug, REGION_SHORT_NAMES } from "@/lib/cross-page-config";
import { prepositionForRegionName } from "@/lib/area-db";
import { slugifySegment } from "@/lib/slug";

/**
 * /fri-teltning — Search Console sep. 2026: "fri teltning" (310 visn), "fri
 * teltning kort" (134), "fri teltning danmark" (119), "hvor må man slå telt op"
 * m.fl. ≈ 900 visn/md på pos 8-9 med NUL klik, fordi alt landede på den lange
 * regelguide. Folk vil have et kort. Data: 313 polygoner fra GeoFA (Natur-
 * styrelsens "Fri teltning"-facilitet), statisk JSON i public/data.
 */
export const revalidate = 86400;

const NST_RULES_URL = "https://naturstyrelsen.dk/naturoplevelser/overnatning/fri-teltning/";

const FAQ = [
  {
    question: "Hvad er fri teltning?",
    answer:
      "Fri teltning betyder, at du må slå dit telt op for natten i udvalgte statsskove uden at spørge om lov og uden at betale. Det gælder i de skove, Naturstyrelsen har udpeget – ikke i alle skove – og kun efter 1-2-3-reglen: én overnatning samme sted, højst to telte, og teltene må højst være til tre personer.",
  },
  {
    question: "Hvor må man slå telt op i Danmark?",
    answer:
      "I de skove, der er udpeget til fri teltning (se kortet og listen på denne side), på teltpladser og lejrpladser, og på privat grund med ejerens tilladelse. Uden for de udpegede områder er det ikke tilladt at overnatte i telt i statens skove, og på strande, i klitter, på heder og enge må teltet ikke stå – heller ikke i fri teltning-skovene, fordi det skal stå skjult under træer.",
  },
  {
    question: "Må man tænde bål ved fri teltning?",
    answer:
      "Kun på de bålpladser, der er indrettet til det. Andre steder i skoven må du bruge stormkøkken med indelukket brænder, hvis du sikrer underlaget først. Ved afbrændingsforbud gælder forbuddet også stormkøkkener – tjek Beredskabsstyrelsen inden turen.",
  },
  {
    question: "Er fri teltning gratis?",
    answer:
      "Ja. Der er ingen betaling og ingen booking. Til gengæld er der heller ingen faciliteter – de fleste områder har hverken vand, toilet eller bålplads. Vil du have det, så vælg en teltplads eller et shelter i stedet.",
  },
  {
    question: "Må hunden komme med?",
    answer: "Ja, men i snor – også på overnatningsstedet.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const { count, kommuner } = summarize(loadFriTeltningIndex());
  const title = `Fri teltning i Danmark – kort over ${count} skove | ShelterDK`;
  const description = `Kort og liste over alle ${count} skove med fri teltning i ${kommuner} kommuner. Se hvor du må slå telt op gratis uden booking, 1-2-3-reglen og hvad der gælder for bål, hund og placering.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "https://shelterdk.dk/fri-teltning" },
    openGraph: { title, description, url: "/fri-teltning" },
  };
}

export default function FriTeltningPage() {
  const areas = loadFriTeltningIndex();
  const { count, totalHa, kommuner } = summarize(areas);
  const groups = groupByRegion(areas);
  const lastVerified = getSitePageModified("/fri-teltning");
  const faqJsonLd = JSON.stringify(faqToJsonLd(FAQ));

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Fri teltning" }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <span className="text-primary font-medium">Fri teltning</span>
          </nav>

          <header className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              Fri teltning i Danmark: kort over {count} skove
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              I {count} statsskove – {totalHa.toLocaleString("da-DK")} hektar i {kommuner} kommuner – må du slå telt op
              for natten uden at booke og uden at betale. Her er alle områderne på kort og liste, fordelt på landsdele,
              med reglerne du skal kende, inden du går ind i skoven.
            </p>
            <div className="mt-4">
              <LastVerifiedBadge isoDate={lastVerified} />
            </div>
          </header>

          <QuickAnswer
            url="https://shelterdk.dk/fri-teltning"
            heading="Hurtigt svar om fri teltning"
            answer={`Der er ${count} skove i Danmark med fri teltning – alle statsskove udpeget af Naturstyrelsen. Du må overnatte én nat samme sted med højst to telte til højst tre personer hver (1-2-3-reglen), teltet skal stå skjult under træer, og bål er kun tilladt på indrettede bålpladser. Det koster ikke noget og kræver ingen booking.`}
            questionHint="Siden besvarer spørgsmål som “hvor må man slå telt op”, “fri teltning kort” og “må man tænde bål ved fri teltning”."
            dateModified={lastVerified}
          />

          <section className="my-8" aria-labelledby="kort">
            <h2 id="kort" className="font-serif text-2xl font-bold text-primary mb-4">
              Kort over fri teltning
            </h2>
            <FriTeltningMapClient />
            <p className="mt-2 text-sm text-primary/60">
              Grønne områder er skove med fri teltning. Klik på et område for detaljer. Kilde: Naturstyrelsen via GeoFA.
            </p>
          </section>

          <section className="mb-10 rounded-2xl border border-accent/20 bg-accent/5 p-6">
            <h2 className="font-serif text-2xl font-bold text-primary mb-3">Reglerne – kort</h2>
            <ul className="space-y-2 text-primary/85">
              {[
                ["1-2-3-reglen", "Én overnatning samme sted, højst to telte, højst tre personer pr. telt."],
                ["Under træer, ude af syne", "Teltet skal stå skjult i træbevoksede dele af skoven – ikke på strand, klit, hede, eng eller mark, og ikke synligt fra veje, stier eller bygninger."],
                ["Bål kun på bålpladser", "Ellers stormkøkken med indelukket brænder på sikret underlag. Ved afbrændingsforbud: heller ikke stormkøkken."],
                ["Hund i snor", "Også på overnatningsstedet."],
                ["Ingen motorkørsel", "Bilen bliver ved P-pladsen."],
                ["Affald med hjem", "Også toiletpapir."],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <span className="text-accent" aria-hidden>•</span>
                  <span><strong>{k}:</strong> {v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              <a href={NST_RULES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                Naturstyrelsens fulde regler for fri teltning
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              {" · "}
              <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">
                Alle regler for shelter og teltning
              </Link>
            </p>
          </section>

          <AdBanner />

          {groups.map(({ region, areas: list }) => {
            const short = REGION_SHORT_NAMES[canonicalRegionSlug(region)] ?? region;
            const prep = prepositionForRegionName(region);
            return (
              <section key={region} className="mb-10" aria-labelledby={`region-${canonicalRegionSlug(region)}`}>
                <h2 id={`region-${canonicalRegionSlug(region)}`} className="font-serif text-2xl font-bold text-primary mb-1">
                  Fri teltning {prep} {short}
                </h2>
                <p className="text-sm text-primary/60 mb-4">
                  {list.length} skove · {formatHa(list.reduce((s, a) => s + (a.ha ?? 0), 0))} ·{" "}
                  <Link href={`/danmark/${canonicalRegionSlug(region)}`} className="text-accent hover:underline">
                    shelters {prep} {short}
                  </Link>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((a) => (
                    <details key={a.slug} id={`omraade-${a.slug}`} className="group rounded-xl border border-primary/10 bg-white/60 p-4">
                      <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                        <span>
                          <span className="font-semibold text-primary">{a.name}</span>
                          <span className="block text-sm text-primary/60">
                            {a.kommune}{a.ha ? ` · ${formatHa(a.ha)}` : ""}{a.water ? " · vandhane" : ""}
                          </span>
                        </span>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-primary/40 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="mt-3 text-sm text-primary/85 space-y-2">
                        {a.description && <p className="whitespace-pre-line">{a.description}</p>}
                        <p className="text-primary/60">
                          {a.org && <>{a.org}{a.contact ? ` · ${a.contact}` : ""}<br /></>}
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-accent hover:underline"
                          >
                            Åbn i Google Maps
                          </a>
                          {a.link && (
                            <>
                              {" · "}
                              <a href={a.link} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                                Naturguide
                              </a>
                            </>
                          )}
                          {a.kommune && (
                            <>
                              {" · "}
                              <Link href={`/danmark/${slugifySegment(region)}/${slugifySegment(a.kommune)}`} className="text-accent hover:underline">
                                Shelters i {a.kommune}
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="mb-10 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">Ofte stillede spørgsmål om fri teltning</h2>
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
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Vil du hellere have tag over hovedet?</h2>
            <p className="text-primary/85">
              Fri teltning er uden faciliteter. Med et <Link href="/" className="text-accent hover:underline">shelter</Link> får du
              læ og ofte bålplads, og på en <Link href="/teltplads" className="text-accent hover:underline">teltplads</Link> er der som
              regel vand og toilet. Skal I være flere, så se <Link href="/baalhytte" className="text-accent hover:underline">bålhytterne</Link>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
