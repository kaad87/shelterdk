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
            ShelterDK er et hobbyprojekt. Her beskriver vi kort, hvordan vi bruger cookies og
            hvilke data der kan blive indsamlet.
          </p>
        </header>

        <div className="prose prose-primary max-w-none space-y-10">
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Cookies</h2>
            <p className="text-primary/80 leading-relaxed">
              Vi bruger cookies og lignende lagring (fx i din browser) til to formål:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-2 mt-4">
              <li>
                <strong>Nødvendige cookies</strong> – Så siden fungerer (fx at huske dit
                cookievalg). Disse kan ikke slås fra.
              </li>
              <li>
                <strong>Valgfrie cookies</strong> – Statistik og forbedring via Google Tag Manager
                (GTM) og Google Analytics. GTM indlæses altid, men bruger Google Consent Mode v2 —
                når du vælger &quot;Kun nødvendige&quot;, sættes ingen tracking-cookies, og der
                sendes kun anonyme, aggregerede signaler. Vælger du &quot;Acceptér alle&quot;,
                aktiveres fuld statistik og personaliserede annoncer.
              </li>
            </ul>
            <p className="text-primary/80 leading-relaxed mt-4">
              Hvis du vælger &quot;Kun nødvendige&quot;, sender Google Tag Manager anonymiserede
              signaler uden cookies (Google Consent Mode v2). Disse bruges af Google til at
              modellere aggregeret statistik — ingen personlige data indsamles. Derudover kan
              der vises kontekstuelle (ikke-personaliserede) annoncer via AdSense.
            </p>
            <p className="text-primary/80 leading-relaxed mt-4">
              Dit valg gemmes i din browser (localStorage og en cookie) i op til ét år. Du kan
              til enhver tid ændre valget ved at slette cookies for shelterdk.dk og genindlæse
              siden – så vises cookiebanneren igen.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Data vi bruger
            </h2>
            <p className="text-primary/80 leading-relaxed">
              ShelterDK henter shelterdata fra offentlige kilder (bl.a. GeoFA, Naturstyrelsen,
              kommuner). Vi indsamler ikke persondata fra dig, medmindre du aktivt sender os noget
              (fx via kontakt, upload af billeder eller tilmelding til nyhedsbrev). Hvis du
              accepterer valgfrie cookies, kan tjenester som Google Analytics (via GTM) og
              StackAdapt indsamle data om din brug af siden – se deres respektive
              privatlivspolitikker for detaljer. Ved &quot;Kun nødvendige&quot; kører GTM i
              Consent Mode (ingen cookies, kun anonyme signaler).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Nyhedsbrev</h2>
            <p className="text-primary/80 leading-relaxed">
              Hvis du tilmelder dig vores nyhedsbrev, gemmer vi din email-adresse i en sikker database
              (Supabase) udelukkende til at sende dig nyhedsbreve om shelterture, nye pladser og
              sæsonguides. Vi deler ikke din email med tredjeparter.
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-2 mt-4">
              <li>
                <strong>Hvad vi gemmer</strong> – Din email og hvilken side du tilmeldte dig fra.
              </li>
              <li>
                <strong>Hvor længe</strong> – Indtil du afmelder dig.
              </li>
              <li>
                <strong>Afmelding</strong> – Du kan til enhver tid afmelde dig via et link i
                nyhedsbrevet, eller ved at kontakte os.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Spørgsmål</h2>
            <p className="text-primary/80 leading-relaxed">
              Har du spørgsmål om cookies eller privatliv, kan du skrive til os via{" "}
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
