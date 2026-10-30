import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { GearCard } from "@/components/GearCard";
import { faqToJsonLd } from "@/lib/faq";
import { buildItemListSchema } from "@/lib/buying-guides-schema";
import { getGaveforslag } from "@/lib/kampagne";
import { hasPublishedStayGuides } from "@/lib/nature-stays";

// Et doegn. Forslagene kommer fra vores egne guider og skifter kun, naar en
// guide bliver redigeret, eller en vare gaar ud af lager.
export const revalidate = 86400;

// Titlen taeller bevidst ikke forslagene. Antallet aendrer sig, hver gang en
// vare gaar ud af lager, og en titel, der lover 27 og viser 24, er en daarlig
// handel for et tal, ingen soeger paa.
const TITLE = "Julegaver til friluftsfolk: gaveideer under 1.000 kr.";
const DESCRIPTION =
  "Gaveideer til ham eller hende, der sover i shelter. Hvert forslag er det bedst scorede grej fra vores egne købsguider, delt op efter pris: under 200, 200 til 500 og 500 til 1.000 kr.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/julegaver" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/julegaver", type: "website" },
};

const FAQ = [
  {
    question: "Hvad giver man en, der er glad for shelter og friluftsliv?",
    answer:
      "Det sikreste er forbrugsgrej og småting, de ikke selv får købt: et godt tændstål, en pandelampe med nok lys, mikrofiberhåndklæde, vabelplastre, en dry bag eller et frysetørret måltid. Hold dig fra sovepose, telt og vandrestøvler, medmindre du ved præcis hvilken model og størrelse de mangler. De tre ting afhænger af krop, temperatur og vaner, og de er dyre at gætte forkert på.",
  },
  {
    question: "Hvor kommer forslagene fra?",
    answer:
      "Hvert forslag er en vare, der i forvejen står i en af vores købsguider, og det er den bedst scorede vare fra den guide inden for prisklassen. Vi har ikke sammensat en gaveliste for sig: vi har taget det, vi allerede har vurderet, og sorteret det efter pris. Derfor står der et link til guiden under hvert forslag, så du kan se, hvad det blev holdt op imod.",
  },
  {
    question: "Kan man give grej i gave, når man ikke kender størrelsen?",
    answer:
      "Ja, hvis du holder dig til det, der ikke skal passe. Lamper, knive, kogegrej, tændstål, drikkedunke, kompas, dry bags, siddeunderlag og mad er størrelsesfri. Tøj, støvler, sandaler og rygsække er ikke, og en vandrerygsæk skal tilmed passe til ryglængden og ikke til højden.",
  },
  {
    question: "Hvornår skal man bestille for at nå det til jul?",
    answer:
      "De danske outdoor-forhandlere, vi henter priser fra, sender typisk 1 til 3 hverdage efter bestilling. Bestiller du senest midt i december, er du i god tid. I ugen op til jul er det postvæsenet og ikke butikken, der sætter grænsen.",
  },
];

export default async function JulegaverPage() {
  const trin = await getGaveforslag();
  // Samme vagt som /bedste og footeren. /naturophold lister guider, og der
  // er ingen udgivne endnu, saa hubben siger "Guiderne er paa vej". Et link
  // dertil fra en gaveside er en blindgyde. Vagten taender det selv, naar
  // den foerste guide bliver udgivet.
  const visNaturophold = await hasPublishedStayGuides().catch(() => false);
  const alle = trin.flatMap((t) => t.forslag);

  const itemList =
    alle.length > 0
      ? buildItemListSchema(
          alle.map((g) => ({ product: g.product })),
          "https://shelterdk.dk/julegaver"
        )
      : null;

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Julegaver" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(FAQ)) }}
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
          <span className="font-medium text-primary">Julegaver</span>
        </nav>

        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-primary md:text-4xl">
            Julegaver til friluftsfolk
          </h1>
          <p className="mt-3 max-w-2xl text-primary/70">
            {alle.length} forslag til ham eller hende, der sover i shelter. Vi har ikke
            sammensat en gaveliste for sig. Hvert forslag er den bedst scorede vare fra en
            af vores {new Set(alle.map((g) => g.guideSlug)).size} købsguider inden for
            prisklassen, og der står et link til guiden under hvert enkelt, så du kan se,
            hvad den blev holdt op imod.
          </p>
          <p className="mt-3 max-w-2xl rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary/75">
            <strong className="text-primary">Et råd, før du vælger:</strong> hold dig fra
            sovepose, telt og vandrestøvler, medmindre du ved præcis hvilken model der
            mangler. De tre afhænger af krop, temperatur og vaner, og de er dyre at gætte
            forkert på. Alt herunder kan gives uden at kende en størrelse.
          </p>
        </header>

        <nav className="mb-10 flex flex-wrap gap-2" aria-label="Spring til prisklasse">
          {trin.map((t) => (
            <a
              key={t.trin.id}
              href={`#${t.trin.id}`}
              className="rounded-full border border-primary/15 bg-white px-4 py-1.5 text-sm font-medium text-primary/75 transition-colors hover:border-accent/30 hover:text-accent"
            >
              {t.trin.overskrift}
              <span className="ml-1.5 text-primary/40">{t.forslag.length}</span>
            </a>
          ))}
        </nav>

        {trin.map(({ trin: t, forslag }) => (
          <section key={t.id} id={t.id} className="mb-14 scroll-mt-8">
            <h2 className="font-serif text-2xl font-bold text-primary">{t.overskrift}</h2>
            {forslag.length === 0 ? (
              <p className="mt-2 text-sm text-primary/60">
                Ingen af vores guider har lige nu en vare på lager i den prisklasse.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-primary/60">
                  {forslag.length} forslag. Højst ét fra hver guide, så listen bliver til
                  forskellige slags gave og ikke til seks knive.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {forslag.map((g) => (
                    <div key={g.product.id} className="flex flex-col">
                      <GearCard id={g.product.id} variant="product" preloaded={g.product} />
                      <p className="mt-1.5 px-1 text-xs text-primary/60">
                        {g.bestFor ? <span className="text-primary/75">{g.bestFor}. </span> : null}
                        {g.score !== null ? `Score ${g.score.toString().replace(".", ",")}/10 i ` : "Fra "}
                        <Link href={`/bedste/${g.guideSlug}`} className="text-accent underline">
                          {g.guideTitle.toLowerCase()}
                        </Link>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ))}

        <section className="mb-12 rounded-xl border border-primary/15 bg-primary/5 p-6 md:p-8">
          <h2 className="font-serif text-xl font-bold text-primary">
            Giver du en oplevelse i stedet?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-primary/75">
            En overnatning i shelter koster som regel ingenting, og de fleste pladser kan
            bookes online. Et printet kort med en rute og en booket plads er en gave, der
            ikke fylder i skabet bagefter.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/shelter-booking" className="text-accent underline">
              Shelters der kan bookes
            </Link>
            <span className="mx-2 text-primary/30">·</span>
            <Link href="/ruteplanner" className="text-accent underline">
              Planlæg en rute
            </Link>
            {visNaturophold && (
              <>
                <span className="mx-2 text-primary/30">·</span>
                <Link href="/naturophold" className="text-accent underline">
                  Naturophold og glamping
                </Link>
              </>
            )}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-serif text-2xl font-bold text-primary">
            Ofte stillede spørgsmål om gaver til friluftsfolk
          </h2>
          <dl className="mt-4 space-y-5">
            {FAQ.map((f) => (
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
          {" · "}
          <Link href="/bedste" className="underline">
            Alle vores købsguider
          </Link>
        </p>
      </main>
    </>
  );
}
