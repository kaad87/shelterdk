import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { GearCard } from "@/components/GearCard";
import { faqToJsonLd } from "@/lib/faq";
import { buildItemListSchema } from "@/lib/buying-guides-schema";
import { getKampagneTilbud, blackFridayStatus } from "@/lib/kampagne";
import { KATEGORI_GUIDE } from "@/lib/kategori-labels";

// En time. Siden skal foelge feedet taet nok til at vaere rigtig i selve
// ugen, men den maa ikke rendere paa hver visning: den henter 400 raekker.
export const revalidate = 3600;

const DESCRIPTION =
  "Vi viser kun grej, hvor før-prisen faktisk er højere end prisen i dag. Se de reelle prisfald på soveposer, telte, pandelamper og vandregrej, og hvad der er værd at vente på.";

/**
 * Aarstallet staar IKKE i en konstant paa modulniveau.
 *
 * Modulet indlaeses én gang pr. serverproces og lever videre mellem
 * revalideringer. En konstant ville derfor blive ved med at sige "2026" ind i
 * 2027, lige indtil processen blev genstartet. generateMetadata koerer ved
 * hver revalidering.
 */
export async function generateMetadata(): Promise<Metadata> {
  const title = `Black Friday ${blackFridayStatus(new Date()).aar}: outdoor- og sheltergrej`;
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/black-friday" },
    openGraph: { title, description: DESCRIPTION, url: "/black-friday", type: "website" },
  };
}

function byggFaq(status: ReturnType<typeof blackFridayStatus>) {
  return [
  {
    question: "Hvornår er Black Friday i år?",
    answer:
      `Black Friday er altid dagen efter den fjerde torsdag i november. I ${status.aar} falder den derfor ${new Intl.DateTimeFormat(
        "da-DK",
        { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
      ).format(status.dato)}. De fleste danske outdoor-forhandlere starter tilbuddene i løbet af ugen før og lader dem køre til og med Cyber Monday om mandagen.`,
  },
  {
    question: "Er rabatterne på Black Friday ægte?",
    answer:
      "Nogle af dem. Problemet er, at langt de fleste produktfeeds sender den samme pris i både før-feltet og nu-feltet, så en vare kan stå med en rabatprocent uden at være sat ned. Vi viser derfor kun varer, hvor før-prisen er højere end prisen i dag, og vi regner rabatten ud af de to priser i stedet for at stole på forhandlerens eget rabatfelt.",
  },
  {
    question: "Hvilket outdoor-grej bliver typisk sat mest ned?",
    answer:
      "Tøj og tilbehør falder mest: fleece, regntøj, dunjakker, sokker, pandelamper og tasker. Soveposer, telte og liggeunderlag falder mindre og sjældnere, fordi de har længere sæson og højere varelagerbinding. Skal du bruge en sovepose eller et telt, er det derfor sjældent værd at vente på november alene.",
  },
  {
    question: "Hvad tjener ShelterDK på siden her?",
    answer:
      "Alle links til forhandlere er affiliate-links, så vi får en andel, hvis du køber. Det ændrer ikke rækkefølgen: siden sorterer efter det faktiske prisfald, og vi skriver kun, hvad tallene i feedet kan bære.",
  },
  ];
}

function formatDato(d: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

export default async function BlackFridayPage() {
  const status = blackFridayStatus(new Date());
  const faq = byggFaq(status);
  const { varer, minRabat, kandidater } = await getKampagneTilbud();

  // Kategorierne i udvalget, i den raekkefoelge de optraeder, saa krydslinkene
  // nedenfor peger paa det, siden faktisk viser i dag.
  const kategorier = [...new Set(varer.map((v) => v.category_mapped).filter(Boolean))] as string[];

  const itemList =
    varer.length > 0
      ? buildItemListSchema(
          varer.map((product) => ({ product })),
          "https://shelterdk.dk/black-friday"
        )
      : null;

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: `Black Friday ${status.aar}` }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faq)) }}
      />
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      )}

      <main className="mx-auto max-w-6xl px-4 py-10">
        <nav className="mb-4 text-sm text-primary/60" aria-label="Brødkrummesti">
          <Link href="/" className="hover:text-accent">
            Hjem
          </Link>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-primary">Black Friday {status.aar}</span>
        </nav>

        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-primary md:text-4xl">
            Black Friday {status.aar}: outdoor- og sheltergrej
          </h1>

          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white">
            {status.erIGang
              ? "Black Friday er i gang"
              : status.dage === 1
                ? "Black Friday er i morgen"
                : `${status.dage} dage til Black Friday`}
            <span className="font-normal text-white/70">{formatDato(status.dato)}</span>
          </p>

          <p className="mt-4 max-w-2xl text-primary/70">
            {status.erIGang
              ? "Her er de største reelle prisfald på outdoor-grej hos vores danske partnere lige nu."
              : `Vi opdaterer siden hver time frem mod dagen. Indtil da står her det grej, der faktisk er sat ned i forvejen, og der er mere end nok at tage af: ${kandidater} varer hos vores partnere har lige nu en før-pris, der er højere end prisen i dag.`}
          </p>
        </header>

        {/* Det her afsnit er sidens egentlige grund til at findes. Alle andre
            Black Friday-sider lister rabatprocenter. Feedet kan ikke baere dem,
            og det kan vi dokumentere, saa det siger vi i stedet. */}
        <section className="mb-10 rounded-xl border border-primary/15 bg-primary/5 p-6 md:p-8">
          <h2 className="font-serif text-xl font-bold text-primary">
            Sådan ved du, om rabatten er ægte
          </h2>
          <div className="mt-3 space-y-3 text-sm text-primary/75">
            <p>
              Næsten alle produktfeeds sender den samme pris i både før-feltet og
              nu-feltet. En vare kan derfor stå med en rabatprocent, uden at prisen er
              faldet én krone. Det er ikke snyd fra forhandlerens side, det er bare
              felter, der bliver udfyldt automatisk, men resultatet er det samme for dig,
              der skal købe.
            </p>
            <p>
              <strong className="text-primary">Vi viser kun varer, hvor før-prisen er højere end prisen i dag</strong>, og vi
              regner rabatten ud af de to priser frem for at bruge forhandlerens eget
              rabatfelt. Det er grunden til, at listen herunder er kortere end dem, du
              finder andre steder.
            </p>
            <p>
              Tre ting, du selv kan tjekke: om varen har ligget til den pris før (mange
              har), om før-prisen er vejledende udsalgspris frem for den pris, butikken
              faktisk solgte til, og om det er sidste sæsons model. Ingen af delene gør
              tilbuddet dårligt, men de gør rabatprocenten mindre interessant end
              slutprisen.
            </p>
          </div>
        </section>

        {varer.length === 0 ? (
          <div className="rounded-xl bg-primary/5 py-16 text-center">
            <h2 className="font-serif text-xl text-primary">Ingen reelle prisfald lige nu</h2>
            <p className="mx-auto mt-2 max-w-md text-primary/60">
              Der er i øjeblikket ingen varer hos vores partnere med en før-pris, der er
              højere end dagsprisen. Siden opdaterer sig selv, så kig forbi igen.
            </p>
            <Link href="/bedste" className="mt-4 inline-block text-sm text-accent underline">
              Se vores købsguider imens
            </Link>
          </div>
        ) : (
          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-primary">
              De største prisfald lige nu
            </h2>
            <p className="mt-2 text-sm text-primary/60">
              {varer.length} varer fra {kategorier.length} kategorier. Alt på listen er sat
              mindst {minRabat} % ned i forhold til forhandlerens egen før-pris. Højst tre
              varer pr. kategori, så siden ikke bliver én lang række soveposer.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {varer.map((p) => (
                // Kortet viser selv rabatbadgen, dagsprisen og den
                // overstregede foer-pris. En linje under det ville sige det
                // samme tre gange.
                <GearCard key={p.id} id={p.id} variant="product" preloaded={p} />
              ))}
            </div>
          </section>
        )}

        {kategorier.length > 0 && (
          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-primary">
              Hvad er bedst, ikke kun billigst?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-primary/70">
              En rabat siger ikke, om varen er god. Vi har en købsguide til de fleste af de
              kategorier, der er sat ned i dag.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {kategorier.map((kat) => {
                const guide = KATEGORI_GUIDE[kat];
                if (!guide) return null;
                return (
                  <li key={kat}>
                    <Link
                      href={`/bedste/${guide.slug}`}
                      className="inline-block rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-sm font-medium text-primary/75 transition-colors hover:border-accent/30 hover:text-accent"
                    >
                      Bedste {guide.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm">
              <Link href="/bedste" className="text-accent underline">
                Se alle vores købsguider
              </Link>
              <span className="mx-2 text-primary/30">·</span>
              <Link href="/tilbud" className="text-accent underline">
                Se alle tilbud året rundt
              </Link>
            </p>
          </section>
        )}

        <section className="mb-10">
          <h2 className="font-serif text-2xl font-bold text-primary">
            Ofte stillede spørgsmål om Black Friday
          </h2>
          <dl className="mt-4 space-y-5">
            {faq.map((f) => (
              <div key={f.question}>
                <dt className="font-semibold text-primary">{f.question}</dt>
                <dd className="mt-1 text-sm text-primary/70">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-xs text-primary/50">
          Alle produktlinks er affiliate-links.{" "}
          <Link href="/annoncer-og-partnere" className="underline">
            Læs om hvordan det virker
          </Link>
          {" · "}
          <Link href="/saadan-vurderer-vi" className="underline">
            Sådan vurderer vi grej
          </Link>
        </p>
      </main>
    </>
  );
}
