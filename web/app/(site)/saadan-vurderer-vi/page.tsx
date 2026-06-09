import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const metadata: Metadata = {
  title: { absolute: "Sådan vurderer vi grej | ShelterDK" },
  description:
    "Sådan udvælger og rangerer ShelterDK outdoor-grej i vores købsguider — vores metode, kriterier og ærlige forhold til affiliate-links.",
  alternates: { canonical: "https://shelterdk.dk/saadan-vurderer-vi" },
  robots: { index: true, follow: true },
};

export default function MethodologyPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[{ label: "Hjem", href: "/" }, { label: "Sådan vurderer vi" }]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70">
            <Link href="/" className="hover:text-accent transition-colors">
              Hjem
            </Link>
            <span aria-hidden="true">›</span>
            <span className="text-primary font-medium">Sådan vurderer vi</span>
          </nav>

          <h1 className="mb-4 font-serif text-3xl font-bold text-primary md:text-4xl">
            Sådan vurderer vi grej
          </h1>

          <div className="prose prose-primary max-w-none text-primary/90">
            <p>
              Vores købsguider skal hjælpe dig med at vælge rigtigt — ikke bare sælge dig noget. Her
              er præcis hvordan vi udvælger og rangerer produkterne.
            </p>

            <h2>Vores kriterier</h2>
            <ul>
              <li>
                <strong>Specs og egnethed</strong> — temperatur, vægt, materiale og hvor godt
                produktet passer til den brug guiden handler om (fx shelter- og friluftsovernatning).
              </li>
              <li>
                <strong>Pris og værdi</strong> — hvad du får for pengene, ikke kun den laveste pris.
              </li>
              <li>
                <strong>Tilgængelighed</strong> — vi anbefaler kun grej der faktisk kan købes;
                udsolgte produkter ryger ned i rangeringen.
              </li>
              <li>
                <strong>Friluftserfaring</strong> — vores egen erfaring fra ophold i shelters og på
                tur i dansk natur.
              </li>
              <li>
                <strong>Eksterne tests og anmeldelser</strong> — vi gennemgår test fra anerkendte
                kilder og linker til dem i hver guide.
              </li>
            </ul>

            <h2>Sådan scorer vi (0-10)</h2>
            <p>
              Hvert produkt i en guide får en samlet score fra 0 til 10. Scoren er en redaktionel
              vurdering ud fra en fast rubrik — ikke et resultat af en labtest. Vi vægter:
            </p>
            <ul>
              <li>
                <strong>Værdi-for-pengene</strong> (vægter mest) — hvad du får for prisen, ikke bare
                den laveste pris.
              </li>
              <li>
                <strong>Egnethed og specs</strong> — temperatur, vægt og materiale ift. den brug
                guiden handler om.
              </li>
              <li>
                <strong>Brand-pålidelighed</strong> — anerkendt kvalitet, garanti og holdbarhed.
              </li>
              <li>
                <strong>Tilgængelighed</strong> — produktet skal faktisk kunne købes; udsolgte
                rykker ned.
              </li>
            </ul>
            <p>
              Scoren oversættes til en stjernevurdering på siden. To produkter med samme score kan
              vinde forskellige &quot;bedst til&quot;-kategorier, fordi de passer til hver sit behov.
            </p>

            <h2>Det vi IKKE gør</h2>
            <p>
              Vi har ikke et testlab, og vi laver ikke fysiske labtests af hvert produkt. Vores
              rangeringer bygger på specifikationer, pris, eksterne tests og friluftserfaring — ikke
              på påståede egne målinger vi ikke har lavet. Det siger vi åbent, fordi du fortjener at
              vide hvad anbefalingen bygger på.
            </p>

            <h2>Affiliate og uafhængighed</h2>
            <p>
              Når du køber via et link i vores guider, tjener ShelterDK en kommission. Det koster
              ikke dig ekstra. Vi vælger og rangerer produkter ud fra kriterierne ovenfor — ikke
              efter hvem der betaler mest i kommission. Hvis et bedre produkt ikke giver os
              indtjening, anbefaler vi det alligevel.
            </p>

            <p className="text-sm text-primary/60">
              Har du spørgsmål eller en rettelse? <Link href="/kontakt">Skriv til os</Link> — vi
              opdaterer gerne.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
