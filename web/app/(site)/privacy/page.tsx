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
          <p className="text-primary/50 text-sm mt-3">Senest opdateret: april 2025</p>
        </header>

        <div className="prose prose-primary max-w-none space-y-10">

          {/* COOKIES */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Cookies og samtykke</h2>
            <p className="text-primary/80 leading-relaxed">
              Første gang du besøger ShelterDK, spørger vi om du vil acceptere valgfrie cookies.
              Dit valg gemmes i din browser (localStorage og en cookie ved navn{" "}
              <code className="text-sm bg-primary/5 px-1 rounded">shelterdk_consent</code>) i op til ét år.
              Du kan til enhver tid trække dit samtykke tilbage ved at slette cookies for shelterdk.dk
              og genindlæse siden – så vises valget igen.
            </p>

            <h3 className="font-serif text-lg font-semibold text-primary mt-6 mb-3">Nødvendige cookies</h3>
            <p className="text-primary/80 leading-relaxed">
              Disse er nødvendige for at siden fungerer og kan ikke slås fra:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-2 mt-3">
              <li>
                <strong>shelterdk_consent</strong> – Gemmer dit cookievalg. Sættes af os selv (1. part).
              </li>
            </ul>

            <h3 className="font-serif text-lg font-semibold text-primary mt-6 mb-3">Valgfrie cookies (statistik og annoncering)</h3>
            <p className="text-primary/80 leading-relaxed">
              Vælger du &quot;Acceptér alle&quot;, aktiveres disse tjenester med fuld cookie-adgang:
            </p>
            <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
              <li>
                <strong>Google Analytics 4 (via Google Tag Manager)</strong> – Statistik om besøg,
                sider og adfærd på siden. Data behandles af Google LLC (USA).{" "}
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
                Administreres af Google LLC (USA).
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
              Vælger du &quot;Kun nødvendige&quot;, sættes ingen tracking-cookies. Google Tag Manager
              kører stadig, men i <strong>Google Consent Mode v2</strong>: annoncelagring, brugerdata
              og personalisering er deaktiveret. Google Analytics kan sende anonyme, aggregerede
              modelleringssignaler uden cookies – ingen personlige data indsamles.
            </p>
            <p className="text-primary/80 leading-relaxed mt-4">
              Derudover sender din browser et enkelt, anonymt sidevisningssignal til vores egne
              servere, som videresender det til Google Analytics 4 via Measurement Protocol.
              Signalet indeholder kun den besøgte URL og sidetitel. Hver sidevisning får et
              tilfældigt genereret ID – ingen cookies, ingen fingerprint, ingen forbindelse til dig
              personligt. StackAdapt indlæses slet ikke.
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
            <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
              <li>
                <strong>Nyhedsbrev</strong> – Din e-mailadresse gemmes i vores database (Supabase)
                udelukkende til udsendelse af nyhedsbreve. Vi deler den ikke med tredjeparter.
                Du kan til enhver tid afmelde dig via et link i nyhedsbrevet eller ved at{" "}
                <Link href="/kontakt" className="text-accent underline hover:no-underline">kontakte os</Link>.
              </li>
              <li>
                <strong>Kontaktformular</strong> – Beskeder sendt via kontaktformularen gemmes
                midlertidigt i vores database, så vi kan besvare dem. De slettes efter behandling.
              </li>
              <li>
                <strong>Community-bidrag</strong> – Hvis du indsender tips, billeder eller
                facilitetsopdateringer til et shelter, gemmes dit bidrag i vores database og
                gennemgås af en administrator, inden det evt. vises på siden. Bidrag kan
                indeholde et navn, du selv angiver. Vi deler ikke disse data med tredjeparter.
              </li>
            </ul>
          </section>

          {/* DINE RETTIGHEDER */}
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Dine rettigheder</h2>
            <p className="text-primary/80 leading-relaxed">
              Du har ret til at få indsigt i, rettet eller slettet de personoplysninger, vi
              eventuelt måtte have om dig. Kontakt os via{" "}
              <Link href="/kontakt" className="text-accent underline hover:no-underline">
                kontaktformularen
              </Link>{" "}
              med dit ønske, og vi vender tilbage hurtigst muligt.
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
