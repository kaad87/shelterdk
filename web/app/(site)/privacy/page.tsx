import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

export const metadata: Metadata = {
  title: { absolute: "Privatliv og cookies | ShelterDK" },
  description:
    "Læs hvordan ShelterDK behandler personoplysninger i forbindelse med booking, betaling, cookies og ejerportal.",
  alternates: { canonical: "https://shelterdk.dk/privacy" },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "Privatliv og cookies | ShelterDK",
    description:
      "Læs hvordan ShelterDK behandler personoplysninger i forbindelse med booking, betaling, cookies og ejerportal.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Privatliv og cookies" }]} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <header className="mb-12">
            <h1 className="font-serif text-4xl font-bold text-primary mb-4">
              Privatliv og cookies
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Her kan du læse, hvordan ShelterDK behandler personoplysninger i forbindelse med
              booking, betaling, kontakt, ejerportal og brug af cookies.
            </p>
            <p className="text-primary/50 text-sm mt-3">Senest opdateret: 9. maj 2026</p>
          </header>

          <div className="prose prose-primary max-w-none space-y-10">
            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Dataansvarlig</h2>
              <p className="text-primary/80 leading-relaxed">
                ShelterDK drives af <strong>CKA Media</strong>, CVR <strong>37343080</strong>.
                Du kan kontakte os på{" "}
                <a
                  href="mailto:hej@shelterdk.dk"
                  className="text-accent underline hover:no-underline"
                >
                  hej@shelterdk.dk
                </a>{" "}
                eller via{" "}
                <Link href="/kontakt" className="text-accent underline hover:no-underline">
                  kontaktsiden
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Hvilke oplysninger vi behandler
              </h2>
              <ul className="list-disc pl-6 text-primary/80 space-y-4 mt-3">
                <li>
                  <strong>Bookingoplysninger</strong>: navn, e-mailadresse, antal personer,
                  valgte datoer og eventuel besked til shelter-ejeren.
                </li>
                <li>
                  <strong>Betalingsoplysninger</strong>: oplysninger om betalingens status,
                  beløb, Stripe-session og tekniske referenceoplysninger. Vi gemmer ikke dine
                  kortoplysninger.
                </li>
                <li>
                  <strong>Kommunikation</strong>: beskeder mellem gæst og shelter-ejer,
                  kontaktformularhenvendelser og automatiske servicemails.
                </li>
                <li>
                  <strong>Ejerportal</strong>: oplysninger om shelter-ejere, login, invitering
                  og administration af bookbare shelters.
                </li>
                <li>
                  <strong>Cookies og sporingsteknologier</strong>: nødvendige cookies samt
                  valgfrie teknologier til statistik og markedsføring, hvis du giver samtykke.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Formål og behandlingsgrundlag
              </h2>
              <ul className="list-disc pl-6 text-primary/80 space-y-4 mt-3">
                <li>
                  <strong>Booking og betaling</strong>: Vi bruger bookingoplysninger til at
                  oprette, administrere og gennemføre din booking, håndtere betaling og sende
                  bekræftelser og driftsbeskeder. Retsgrundlaget er{" "}
                  <strong>opfyldelse af aftale</strong> efter GDPR artikel 6, stk. 1, litra b.
                </li>
                <li>
                  <strong>Kundeservice og tvistbehandling</strong>: Vi kan behandle oplysninger
                  om booking og kommunikation for at håndtere fejl, refusioner, misbrug eller
                  supporthenvendelser. Retsgrundlaget er vores{" "}
                  <strong>legitime interesser</strong> efter GDPR artikel 6, stk. 1, litra f.
                </li>
                <li>
                  <strong>Retlige forpligtelser</strong>: Vi kan gemme oplysninger i det omfang
                  det er nødvendigt for bogføring, dokumentation og håndtering af lovkrav.
                  Retsgrundlaget er GDPR artikel 6, stk. 1, litra c.
                </li>
                <li>
                  <strong>Statistik og markedsføring</strong>: Valgfrie cookies og tilsvarende
                  teknologier bruges kun efter dit samtykke. Retsgrundlaget er{" "}
                  <strong>samtykke</strong> efter GDPR artikel 6, stk. 1, litra a.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Deling af bookingoplysninger
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Når du laver en booking, deler vi de nødvendige bookingoplysninger med den
                relevante shelter-ejer, så vedkommende kan administrere opholdet, kommunikere om
                praktiske forhold og håndtere eventuelle aflysninger. Shelter-ejeren må kun bruge
                oplysningerne til administration af opholdet og ikke til markedsføring.
              </p>
              <p className="text-primary/80 leading-relaxed mt-4">
                I denne sammenhæng behandler ShelterDK og shelter-ejeren typisk oplysningerne som
                <strong> selvstændige dataansvarlige</strong> for hver deres formål.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Databehandlere og modtagere
              </h2>
              <ul className="list-disc pl-6 text-primary/80 space-y-4 mt-3">
                <li>
                  <strong>Stripe</strong> håndterer betalingstransaktioner. Kortoplysninger
                  behandles direkte af Stripe.{" "}
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
                <li>
                  <strong>Resend</strong> bruges til udsendelse af bookingrelaterede e-mails og
                  ejerinvites.{" "}
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
                  <strong>Supabase</strong> bruges til drift af databasen bag ShelterDK,
                  herunder bookingdata, ejerkonti og beskeder.
                </li>
                <li>
                  <strong>Google</strong> kan modtage oplysninger, hvis du accepterer statistik
                  eller markedsføring, og når vi bruger Google Places-data på siden.
                </li>
                <li>
                  <strong>StackAdapt</strong> anvendes kun efter markedsføringssamtykke.{" "}
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

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Opbevaringsperioder
              </h2>
              <ul className="list-disc pl-6 text-primary/80 space-y-4 mt-3">
                <li>
                  <strong>Bookingdata</strong> opbevares som udgangspunkt i op til 13 måneder
                  efter afrejsedato, medmindre længere opbevaring er nødvendig pga. bogføring,
                  refusioner, tvister eller dokumentation.
                </li>
                <li>
                  <strong>Kontaktformularer</strong> slettes som udgangspunkt senest 6 måneder
                  efter modtagelse.
                </li>
                <li>
                  <strong>Nyhedsbrev</strong> opbevares, indtil du afmelder dig.
                </li>
                <li>
                  <strong>Community-bidrag</strong> og brugerindhold kan opbevares længere, hvis
                  det er en del af sidens offentlige indhold, indtil det slettes eller redigeres.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Cookies og samtykke
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Når du besøger ShelterDK, kan du vælge mellem tre niveauer:
              </p>
              <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
                <li>
                  <strong>Kun nødvendige</strong>: kun teknisk nødvendige cookies og tilsvarende
                  teknologier bruges.
                </li>
                <li>
                  <strong>Kun statistik</strong>: vi må også bruge statistikværktøjer, herunder
                  Google Analytics.
                </li>
                <li>
                  <strong>Acceptér alle</strong>: vi må også bruge markedsføringsværktøjer som
                  Google AdSense og StackAdapt.
                </li>
              </ul>
              <p className="text-primary/80 leading-relaxed mt-4">
                Dit valg gemmes i op til ét år i localStorage og i cookien{" "}
                <code className="text-sm bg-primary/5 px-1 rounded">shelterdk_consent</code>.
                Du kan til enhver tid ændre valget via <strong>Cookieindstillinger</strong> i
                footeren.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Tredjepartstjenester på siden
              </h2>
              <ul className="list-disc pl-6 text-primary/80 space-y-4 mt-3">
                <li>
                  <strong>Google Analytics 4</strong> bruges kun efter statistik- eller
                  markedsføringssamtykke.
                </li>
                <li>
                  <strong>Google AdSense</strong> bruges kun efter markedsføringssamtykke.
                </li>
                <li>
                  <strong>StackAdapt</strong> bruges kun efter markedsføringssamtykke.
                </li>
                <li>
                  <strong>OpenStreetMap</strong> bruges til kortvisning. Din IP-adresse kan i den
                  forbindelse blive behandlet af OpenStreetMaps infrastruktur.{" "}
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
                  <strong>Google Places</strong> bruges til billeder og vurderingsdata om
                  shelters.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Overførsel til tredjelande
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Nogle af vores leverandører, herunder Google, Stripe og Resend, kan behandle
                personoplysninger uden for EU/EØS, herunder i USA. Når det er relevant, sker det
                på grundlag af leverandørernes standardkontraktbestemmelser eller andre lovlige
                overførselsgrundlag.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Dine rettigheder</h2>
              <p className="text-primary/80 leading-relaxed">
                Du har ret til indsigt, rettelse, sletning, begrænsning, dataportabilitet og til
                at gøre indsigelse mod visse behandlinger. Du kan også trække dit samtykke tilbage,
                hvis en behandling beror på samtykke.
              </p>
              <p className="text-primary/80 leading-relaxed mt-4">
                Skriv til{" "}
                <a
                  href="mailto:hej@shelterdk.dk"
                  className="text-accent underline hover:no-underline"
                >
                  hej@shelterdk.dk
                </a>{" "}
                eller brug{" "}
                <Link href="/kontakt" className="text-accent underline hover:no-underline">
                  kontaktsiden
                </Link>
                . Du kan også klage til{" "}
                <a
                  href="https://www.datatilsynet.dk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  Datatilsynet
                </a>
                .
              </p>
            </section>
          </div>

          <p className="mt-12 pt-8 border-t border-primary/10">
            <Link href="/" className="text-accent font-medium hover:underline">
              &larr; Til forsiden
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
