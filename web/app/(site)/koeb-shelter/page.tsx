import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { AdBanner } from "@/components/AdBanner";
import { GearCardView } from "@/components/GearCardClient";
import { getShelterAlternatives } from "@/lib/buy-shelter";
import { faqToJsonLd } from "@/lib/faq";

export const revalidate = 86400;

const TITLE = "Køb shelter – priser, typer og regler for shelter i haven";
const DESCRIPTION =
  "Hvad koster et shelter? Se prisniveauer for byggesæt og samlesæt, hvilke typer der findes, og hvornår du må stille et shelter i haven uden byggetilladelse.";

/**
 * Priser er indhentet fra danske byggemarkeder august 2026 og bruges som
 * niveau-angivelse, ikke som løbende prissammenligning — derfor intervaller og
 * en synlig dato frem for præcise beløb der hurtigt bliver forkerte.
 */
const PRICE_DATE = "august 2026";

const FAQ = [
  {
    question: "Hvad koster et shelter?",
    answer:
      "Et byg-selv-sæt i træ ligger typisk mellem 9.000 og 20.000 kr afhængigt af størrelse, mens færdige samlesæt ligger i den øvre halvdel af intervallet. Bygger du helt fra bunden af eget træ, kan materialeprisen komme under 5.000 kr, men så skal du selv stå for konstruktion og tag.",
  },
  {
    question: "Må man have et shelter i sin have?",
    answer:
      "Ja, i langt de fleste tilfælde. Et shelter regnes som sekundær bebyggelse, og på en almindelig parcelhusgrund må du opføre op til 50 m² sekundær bebyggelse i alt uden byggetilladelse. Et typisk shelter fylder 5-10 m², så det er sjældent arealet der er problemet — men det tæller sammen med carport, skur og drivhus.",
  },
  {
    question: "Hvor tæt på skel må shelteret stå?",
    answer:
      "Sekundær bebyggelse skal som udgangspunkt placeres mindst 2,5 meter fra skel, medmindre andet er aftalt med naboen eller fremgår af lokalplanen. Står det tættere, kan kommunen kræve det flyttet.",
  },
  {
    question: "Skal jeg søge byggetilladelse til et shelter?",
    answer:
      "Normalt ikke, så længe du holder dig under 50 m² samlet sekundær bebyggelse, placerer det på terræn og overholder afstanden til skel. Men lokalplanen for dit område kan stille strengere krav, og bygningen må ikke bruges til beboelse. Tjek altid med din kommune inden du går i gang.",
  },
  {
    question: "Hvad er forskellen på byg-selv og samlesæt?",
    answer:
      "Et byg-selv-sæt leveres som materialer du selv skal save til og samle. Et samlesæt har præcise, tilskårne dele og en vejledning, så det mest handler om at skrue sammen. Samlesæt koster typisk 2.000-4.000 kr mere, men sparer tid og værktøj.",
  },
];

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | ShelterDK` },
  description: DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/koeb-shelter" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/koeb-shelter" },
};

export default async function KoebShelterPage() {
  const alternatives = await getShelterAlternatives(3);
  const faqJsonLd = JSON.stringify(faqToJsonLd(FAQ));

  return (
    <>
      <BreadcrumbSchema
        items={[{ label: "Hjem", href: "/" }, { label: "Køb shelter" }]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <nav className="mb-6 text-sm text-primary/70" aria-label="Brødkrummesti">
            <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
              <li>
                <Link href="/" className="hover:text-accent transition-colors">Forside</Link>
              </li>
              <li aria-hidden className="text-primary/50">/</li>
              <li className="text-primary font-medium">Køb shelter</li>
            </ol>
          </nav>

          <h1 className="font-serif text-3xl lg:text-4xl font-bold text-primary mb-4">
            Køb shelter: priser, typer og regler
          </h1>
          <p className="text-primary/90 text-lg leading-relaxed mb-8">
            Vil du have dit eget shelter i haven, i skovkanten eller på sommerhusgrunden,
            er der tre spørgsmål der plejer at komme først: hvad koster det, hvilken type
            skal jeg vælge, og må jeg overhovedet stille det op? Her får du svarene —
            med de faktiske prisniveauer og de regler der gælder.
          </p>

          <section className="mb-10 rounded-xl border border-accent/15 bg-accent/[0.04] p-5">
            <h2 className="font-serif text-lg font-bold text-primary mb-2">Kort fortalt</h2>
            <ul className="space-y-1.5 text-primary/85">
              <li>Byg-selv-sæt i træ: typisk <strong>9.000–20.000 kr</strong></li>
              <li>Samlesæt med tilskårne dele: typisk <strong>11.000–15.000 kr</strong></li>
              <li>Du må have op til <strong>50 m²</strong> sekundær bebyggelse uden byggetilladelse</li>
              <li>Mindst <strong>2,5 meter</strong> til skel</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-4">
              Hvad koster et shelter?
            </h2>
            <p className="text-primary/85 leading-relaxed mb-4">
              Et klassisk A-shelter i træ — den åbne type med skråt tag som du kender fra
              shelterpladserne — fås som byggesæt hos de store byggemarkeder. Priserne
              nedenfor er niveauer fra {PRICE_DATE} og varierer med størrelse, trætype og
              om taget er med.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-primary/15 text-left">
                    <th className="py-2 pr-4 font-semibold text-primary">Type</th>
                    <th className="py-2 pr-4 font-semibold text-primary">Prisniveau</th>
                    <th className="py-2 font-semibold text-primary">Hvad kræver det</th>
                  </tr>
                </thead>
                <tbody className="text-primary/85">
                  <tr className="border-b border-primary/10">
                    <td className="py-3 pr-4">Byg helt selv</td>
                    <td className="py-3 pr-4">fra ca. 5.000 kr</td>
                    <td className="py-3">Egne tegninger, sav og tid</td>
                  </tr>
                  <tr className="border-b border-primary/10">
                    <td className="py-3 pr-4">Byg-selv-sæt</td>
                    <td className="py-3 pr-4">9.000–20.000 kr</td>
                    <td className="py-3">Materialer følger med, du tilskærer</td>
                  </tr>
                  <tr className="border-b border-primary/10">
                    <td className="py-3 pr-4">Samlesæt</td>
                    <td className="py-3 pr-4">11.000–15.000 kr</td>
                    <td className="py-3">Tilskårne dele og vejledning</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Tipi eller lavvu</td>
                    <td className="py-3 pr-4">4.500–45.000 kr</td>
                    <td className="py-3">Ingen byggeri — kan flyttes</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-primary/60">
              Prisniveauer indhentet {PRICE_DATE} fra danske byggemarkeder. Tjek aktuelle
              priser hos forhandleren.
            </p>
          </section>

          <AdBanner />

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-4">
              Må man stille et shelter op i haven?
            </h2>
            <p className="text-primary/85 leading-relaxed mb-4">
              Ja — et shelter regnes i bygningsreglementet som <em>sekundær bebyggelse</em>,
              på linje med skure, carporte, drivhuse og overdækkede terrasser. På en grund
              med enfamiliehus må du opføre op til <strong>50 m² sekundær bebyggelse i alt</strong>{" "}
              uden at søge byggetilladelse. Et typisk shelter fylder 5-10 m², så arealet er
              sjældent forhindringen — men husk at det er det <em>samlede</em> areal på
              grunden der tæller, så carport og skur skal regnes med.
            </p>
            <p className="text-primary/85 leading-relaxed mb-4">
              Der er tre betingelser du skal være opmærksom på:
            </p>
            <ul className="mb-4 space-y-2 text-primary/85">
              <li className="flex gap-2">
                <span className="text-accent" aria-hidden>•</span>
                <span>
                  <strong>Afstand til skel:</strong> mindst 2,5 meter, medmindre andet er
                  aftalt med naboen eller fremgår af lokalplanen.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent" aria-hidden>•</span>
                <span>
                  <strong>Placering på terræn:</strong> bygningen skal stå på jorden — ikke
                  hæves eller graves ned.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent" aria-hidden>•</span>
                <span>
                  <strong>Ikke til beboelse:</strong> sekundær bebyggelse må ikke bruges som
                  bolig. Overnatning i ny og næ er noget andet end at bo der.
                </span>
              </li>
            </ul>
            <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
              <p className="text-sm text-primary/80">
                <strong>Vigtigt:</strong> lokalplanen for dit område kan stille strengere
                krav end bygningsreglementet — fx om placering, højde eller materialer. Og
                ligger grunden i landzone, tæt på strand, fortidsminder eller beskyttet
                natur, gælder der helt andre regler. Ring til teknisk forvaltning i din
                kommune inden du går i gang; det tager ti minutter og kan spare dig for at
                skulle rive det ned igen.
              </p>
              <p className="mt-3 text-sm">
                <a
                  href="https://www.bygningsreglementet.dk/administrative-bestemmelser/brv/sekundaer-bebyggelse/2_0_hvor_meget_maa_man_bygge/"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  Læs reglerne i Bygningsreglementet
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-4">
              Hvilken type skal du vælge?
            </h2>
            <div className="space-y-4 text-primary/85">
              <div className="rounded-xl border border-primary/10 bg-white p-5">
                <h3 className="font-semibold text-primary mb-1">Klassisk A-shelter</h3>
                <p className="leading-relaxed">
                  Den åbne trækonstruktion med skråt tag og lukket bagside. Billigst i drift,
                  holder i mange år, og giver den rigtige fornemmelse af at sove ude. Til
                  gengæld er den åben mod vejret fra én side — vend åbningen væk fra vest.
                </p>
              </div>
              <div className="rounded-xl border border-primary/10 bg-white p-5">
                <h3 className="font-semibold text-primary mb-1">Bålhytte</h3>
                <p className="leading-relaxed">
                  Overdækket konstruktion med bålsted i midten og hul i taget. Fylder mere og
                  koster mere, men fungerer året rundt og er velegnet hvis I ofte er flere.
                  Se <Link href="/baalhytte" className="text-accent hover:underline">bålhytter i Danmark</Link>{" "}
                  hvis du vil prøve konceptet af først.
                </p>
              </div>
              <div className="rounded-xl border border-primary/10 bg-white p-5">
                <h3 className="font-semibold text-primary mb-1">Tipi eller lavvu</h3>
                <p className="leading-relaxed">
                  Ikke et byggeri, men et telt. Kan flyttes, kræver ingen tilladelse, og en
                  del modeller tåler brændeovn. Det oplagte valg hvis du er i tvivl om
                  placeringen, lejer grunden, eller bare vil prøve det af.
                </p>
              </div>
            </div>
          </section>

          {alternatives.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-2xl font-bold text-primary mb-2">
                Flytbare alternativer
              </h2>
              <p className="text-primary/70 text-sm mb-5">
                Vi sælger ikke selv shelters. Vil du undgå at bygge, er tipier og store telte
                det nærmeste alternativ — her er nogle af dem vi kan henvise til.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {alternatives.map((p) => (
                  <GearCardView key={p.id} product={p} variant="product" />
                ))}
              </div>
            </section>
          )}

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-4">
              Ofte stillede spørgsmål
            </h2>
            <div className="space-y-4">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-primary/10 bg-white p-5"
                >
                  <summary className="cursor-pointer list-none font-semibold text-primary marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.question}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-accent transition-transform group-open:rotate-90"
                        aria-hidden
                      />
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-primary/80">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <AdBanner />

          <section className="rounded-xl border border-primary/10 bg-primary/[0.03] p-5">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">
              Prøv det af først
            </h2>
            <p className="text-primary/80 text-sm mb-3">
              Inden du investerer i dit eget, er der over 1.600 shelters i Danmark du kan
              overnatte i — mange af dem gratis.
            </p>
            <ul className="space-y-2 text-sm text-primary/80">
              <li>
                <Link href="/soeg" className="text-accent hover:underline">Find shelter nær dig</Link>{" "}
                – søg på område og faciliteter
              </li>
              <li>
                <Link href="/teltplads" className="text-accent hover:underline">Teltpladser i Danmark</Link>{" "}
                – hvis du hellere vil bruge eget telt
              </li>
              <li>
                <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">
                  Regler for shelter og teltning
                </Link>{" "}
                – hvad må man hvor i naturen
              </li>
              <li>
                <Link href="/bedste" className="text-accent hover:underline">Grej-guides</Link>{" "}
                – sovepose, liggeunderlag og resten af udstyret
              </li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
