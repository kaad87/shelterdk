import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const metadata: Metadata = {
  title: { absolute: "Privatliv og cookies | ShelterDK" },
  description:
    "Sådan bruger ShelterDK cookies og håndterer vi data. Nødvendige og valgfrie cookies, Google Tag Manager og dine valg.",
  alternates: { canonical: "https://shelterdk.dk/privacy" },
  openGraph: {
    title: "Privatliv og cookies | ShelterDK",
    description: "Sådan bruger ShelterDK cookies og håndterer vi data. Nødvendige og valgfrie cookies og dine valg.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Privatliv og cookies" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-bold text-primary mb-4">
            Privatliv og cookies
          </h1>
          <p className="text-primary/80 text-lg leading-relaxed">
            ShelterDK er et hobbyprojekt. Her beskriver vi, hvilke cookies og tjenester vi bruger,
            og hvilke data der kan blive indsamlet.
          </p>
          <p className="text-primary/50 text-sm mt-3">Senest opdateret: april 2026</p>
        </header>

        <div className="prose prose-primary max-w-none space-y-10">

          {/* DATAANSVARLIG */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Dataansvarlig</h2>
            <p className="text-primary/80 leading-relaxed">
              ShelterDK drives som et personligt hobbyprojekt fra Danmark. Har du spørgsmål til
              behandlingen af dine personoplysninger, kan du kontakte os via{" "}
              <Link href="/kontakt" className="text-accent underline hover:no-underline">kontaktformularen</Link>.
              Vi bestræber os på at svare inden for 30 dage.
            </p>
          </section>

          {/* COOKIES */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Cookies og samtykke</h2>
            <p className="text-primary/80 leading-relaxed">
              Første gang du besøger ShelterDK, spørger vi om du vil acceptere valgfrie cookies.
              Dit valg gemmes i din browser (localStorage og en cookie ved navn{" "}
              <code className="text-sm bg-primary/5 px-1 rounded">shelterdk_consent</code>) i op til ét år.
              Du kan til enhver tid trække dit samtykke tilbage ved at klikke &quot;Nulstil cookievalg&quot;
              i sidens footer – så vises valget igen.
            </p>

            <h3 className="font-serif text-lg font-semibold text-primary mt-6 mb-3">Nødvendige cookies</h3>
            <p className="text-primary/80 leading-relaxed">
              Disse er nødvendige for at siden fungerer og kan ikke slås fra:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-2 mt-3">
              <li>
                <strong>shelterdk_consent</strong> – Gemmer dit cookievalg. Sættes af os selv (1. part).
                Opbevares i 1 år.
              </li>
            </ul>

            <h3 className="font-serif text-lg font-semibold text-primary mt-6 mb-3">Valgfrie cookies (statistik og annoncering)</h3>
            <p className="text-primary/80 leading-relaxed">
              Vælger du &quot;Acceptér alle&quot;, aktiveres disse tjenester:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
              <li>
                <strong>Google Analytics 4 (via Google Tag Manager)</strong> – Statistik om besøg,
                sider og adfærd på siden. Ved accept kan Google Analytics bruge cookies og lignende
                teknologier. Data behandles af Google LLC (USA).{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  Googles privatlivspolitik
                </a>
                .
              </li>
              <li>
                <strong>Google AdSense</strong> – Personaliserede annoncer baseret på dine interesser.
                Scriptet indlæses kun hvis du vælger &quot;Acceptér alle&quot;. Administreres af
                Google LLC (USA).
              </li>
              <li>
                <strong>StackAdapt</strong> – Annonceringsplatform. Indlæses <em>kun</em> hvis du
                accepterer alle cookies, da StackAdapt ikke understøtter cookiefri drift.{" "}
                <a
                  href="https://www.stackadapt.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  StackAdapts privatlivspolitik
                </a>
                .
              </li>
            </ul>
          </section>

          {/* CONSENT MODE */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Hvad sker der ved &quot;Kun nødvendige&quot;?
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Vælger du &quot;Kun nødvendige&quot;, sætter vi ikke statistik- eller annoncecookies.
              Google Tag Manager kan stadig indlæses for at respektere dit samtykkevalg, men{" "}
              <strong>Google Consent Mode v2</strong>{" "}
              er sat til &quot;denied&quot; for annoncelagring, brugerdata, personalisering og
              analyselagring. Det betyder, at Google-tjenester ikke må bruge disse lagringsformer
              uden dit samtykke.
            </p>
            <p className="text-primary/80 leading-relaxed mt-4">
              For at kunne måle overordnede besøgstal sender vi desuden et begrænset, cookiefrit
              server-side page view til GA4 med en kortlivet pseudonym identifikator baseret på
              IP-adresse og browseroplysninger. Oplysningen bruges kun til aggregeret statistik og
              gemmes ikke som en varig cookie i din browser. StackAdapt og AdSense indlæses slet
              ikke ved valg af kun nødvendige cookies.
            </p>
          </section>

          {/* TREDJEPARTSTJENESTER */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Andre tredjepartstjenester
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Ud over ovenstående bruger ShelterDK disse tjenester til at vise indhold:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
              <li>
                <strong>OpenStreetMap</strong> – Kortfliser til vores interaktive kort hentes fra
                OpenStreetMaps servere. Din IP-adresse kan logges af OpenStreetMap i forbindelse
                med disse anmodninger.{" "}
                <a
                  href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  OpenStreetMaps privatlivspolitik
                </a>
                .
              </li>
              <li>
                <strong>Google Places / Google Maps</strong> – Billeder og anmeldelsesdata for
                shelters hentes fra Googles API. Se Googles privatlivspolitik ovenfor.
              </li>
              <li>
                <strong>Unsplash</strong> – Nogle generiske naturbilleder på siden stammer fra
                Unsplash. Billederne hentes direkte fra Unsplashs CDN.
              </li>
              <li>
                <strong>Resend</strong> – Vi bruger Resend til at afsende transaktionelle e-mails
                (bookingbekræftelser, ejeradvisering). E-mailadresser der indgår i en transaktion
                videregives til Resend udelukkende med henblik på afsendelse.{" "}
                <a
                  href="https://resend.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  Resends privatlivspolitik
                </a>
                .
              </li>
              <li>
                <strong>Stripe</strong> – Betalingstransaktioner håndteres af Stripe Payments Europe.
                Vi gemmer ingen kortoplysninger – de behandles udelukkende af Stripe.{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  Stripes privatlivspolitik
                </a>
                .
              </li>
            </ul>
          </section>

          {/* DATA VI GEMMER */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Data vi gemmer
            </h2>
            <p className="text-primary/80 leading-relaxed">
              ShelterDK henter shelterdata fra offentlige kilder (bl.a. GeoFA, Naturstyrelsen,
              kommuner). Vi indsamler ikke persondata om dig, medmindre du aktivt sender os noget:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-4 mt-3">
              <li>
                <strong>Booking af shelter</strong> – Når du sender en bookingforespørgsel, gemmer
                vi dit navn, din e-mailadresse, antal personer, ønskede datoer og en eventuel besked
                til ejeren. Disse oplysninger deles med shelter-ejeren med henblik på behandling af
                din forespørgsel, og med Resend og Stripe i forbindelse med henholdsvis
                e-mailafsendelse og betaling. Retsgrundlaget er opfyldelse af aftale (GDPR art. 6,
                stk. 1, litra b). Bookingdata opbevares i 13 måneder efter afrejsedato og slettes
                herefter.
              </li>
              <li>
                <strong>Nyhedsbrev</strong> – Din e-mailadresse gemmes i vores database (Supabase)
                udelukkende til udsendelse af nyhedsbreve. Vi deler den ikke med tredjeparter.
                Retsgrundlaget er samtykke (GDPR art. 6, stk. 1, litra a). Adressen opbevares
                indtil du afmelder dig via link i nyhedsbrevet eller{" "}
                <Link href="/kontakt" className="text-accent underline hover:no-underline">kontakter os</Link>.
              </li>
              <li>
                <strong>Kontaktformular</strong> – Beskeder sendt via kontaktformularen gemmes
                midlertidigt i vores database, så vi kan besvare dem. De slettes senest 6 måneder
                efter modtagelse.
              </li>
              <li>
                <strong>Community-bidrag</strong> – Hvis du indsender tips, billeder eller
                facilitetsopdateringer til et shelter, gemmes dit bidrag i vores database og
                gennemgås af en administrator, inden det evt. vises på siden. Bidrag kan
                indeholde et navn, du selv angiver. Vi deler ikke disse data med tredjeparter.
                Bidrag opbevares på ubestemt tid, da de udgør en del af sidens indhold – skriv
                til os hvis du ønsker et bidrag slettet.
              </li>
              <li>
                <strong>Turvenner-opslag</strong> – Hvis du opretter et opslag for at finde
                medrejsende, gemmes opslaget med det indhold du selv har angivet (tekst, område,
                kontaktmetode m.v.) i vores database. Opslaget er offentligt synligt. Det slettes
                automatisk 90 dage efter oprettelse, eller tidligere hvis du rapporterer det eller
                kontakter os.
              </li>
            </ul>
          </section>

          {/* DINE RETTIGHEDER */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Dine rettigheder</h2>
            <p className="text-primary/80 leading-relaxed">
              Du har efter GDPR ret til at:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-2 mt-3">
              <li>Få indsigt i hvilke oplysninger vi har om dig</li>
              <li>Få forkerte oplysninger rettet</li>
              <li>Få oplysninger slettet (&quot;retten til at blive glemt&quot;)</li>
              <li>Gøre indsigelse mod behandlingen</li>
              <li>Trække dit samtykke tilbage (gælder nyhedsbrev og cookies)</li>
            </ul>
            <p className="text-primary/80 leading-relaxed mt-4">
              Kontakt os via{" "}
              <Link href="/kontakt" className="text-accent underline hover:no-underline">
                kontaktformularen
              </Link>{" "}
              med dit ønske, og vi vender tilbage hurtigst muligt og senest inden 30 dage.
              Du kan også klage til{" "}
              <a
                href="https://www.datatilsynet.dk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:no-underline"
              >
                Datatilsynet
              </a>
              , hvis du mener, at vi behandler dine data i strid med lovgivningen.
            </p>
          </section>

          {/* SPØRGSMÅL */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Spørgsmål</h2>
            <p className="text-primary/80 leading-relaxed">
              Har du spørgsmål om cookies eller privatliv, er du velkommen til at skrive til os via{" "}
              <Link href="/kontakt" className="text-accent underline hover:no-underline">
                Kontakt
              </Link>
              .
            </p>
          </section>

        </div>

        <p className="mt-12 pt-8 border-t border-primary/10">
          <Link href="/" className="text-accent font-medium hover:underline">
            ← Til forsiden
          </Link>
        </p>
      </div>
    </div>
    </>
  );
}
