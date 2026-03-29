import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const metadata: Metadata = {
  title: { absolute: "Vilkår og betingelser | ShelterDK" },
  description:
    "Læs vilkår og betingelser for brug af ShelterDK. Information om datakilder, brugerindhold, ansvar og rettigheder.",
  alternates: { canonical: "https://shelterdk.dk/vilkaar" },
  openGraph: {
    title: "Vilkår og betingelser | ShelterDK",
    description:
      "Læs vilkår og betingelser for brug af ShelterDK. Information om datakilder, brugerindhold, ansvar og rettigheder.",
    url: "/vilkaar",
  },
};

export default function VilkaarPage() {
  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Vilkår og betingelser" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-bold text-primary mb-4">
            Vilkår og betingelser
          </h1>
          <p className="text-primary/80 text-lg leading-relaxed">
            Ved at bruge ShelterDK accepterer du nedenstående vilkår. Sidst
            opdateret marts 2026.
          </p>
        </header>

        <div className="prose prose-primary max-w-none space-y-10">
          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Om tjenesten
            </h2>
            <p className="text-primary/80 leading-relaxed">
              ShelterDK er et gratis hobbyprojekt, der samler information om
              shelters og naturovernatning i Danmark. Vi stiller en søgbar
              oversigt til rådighed baseret på offentlige data fra blandt andet
              GeoFA (Geodatastyrelsen), Naturstyrelsen og kommunale datakilder.
              Siden drives uden kommercielt formål ud over eventuelle
              displayannoncer, som hjælper med at dække driftsomkostninger.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Datakilder og nøjagtighed
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Information om shelters, faciliteter, koordinater og
              tilgængelighed stammer fra offentlige registre og tredjeparts
              tjenester (Google Places, OpenStreetMap m.fl.). Vi bestræber os på
              at holde data opdateret, men kan ikke garantere, at alle
              oplysninger er korrekte eller aktuelle. Faciliteter kan ændre sig
              uden varsel, og du bør altid tjekke lokale forhold inden din tur.
            </p>
            <p className="text-primary/80 leading-relaxed mt-4">
              Finder du fejl i oplysningerne om et shelter, er du velkommen til
              at rapportere det via{" "}
              <Link
                href="/kontakt"
                className="text-accent underline hover:no-underline"
              >
                kontaktformularen
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Brugerindhold
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Brugere kan indsende billeder, kommentarer og forslag til
              rettelser. Ved at indsende indhold giver du ShelterDK en
              ikke-eksklusiv, vederlagsfri ret til at vise det på siden. Du
              indestår for, at du har rettighederne til det indsendte materiale,
              og at det ikke krænker andres rettigheder. Vi forbeholder os
              retten til at fjerne indhold, der er stødende, ulovligt eller
              irrelevant.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Ansvarsfraskrivelse
            </h2>
            <p className="text-primary/80 leading-relaxed">
              ShelterDK leveres &quot;som det er&quot; uden garantier af nogen
              art. Vi påtager os intet ansvar for tab, skade eller ulempe, der
              måtte opstå som følge af brug af oplysninger fra siden – herunder
              men ikke begrænset til forkerte koordinater, manglende faciliteter
              eller utilgængelige shelterpladser. Brug altid din egen
              dømmekraft, og følg lokale regler for friluftsliv og overnatning i
              naturen.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Ophavsret
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Design, tekster og grafik på ShelterDK er ophavsretligt beskyttet.
              Shelter-data stammer fra offentlige kilder og er underlagt disses
              respektive licenser. Billeder fra brugere og tredjeparter
              tilhører de pågældende rettighedshavere. Du må gerne linke til
              ShelterDK, men reproduktion af indhold kræver forudgående
              tilladelse.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Cookies og privatliv
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Vi bruger cookies til statistik og funktionalitet. Læs mere i
              vores{" "}
              <Link
                href="/privacy"
                className="text-accent underline hover:no-underline"
              >
                privatlivspolitik
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Ændringer
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Vi kan til enhver tid opdatere disse vilkår. Væsentlige ændringer
              vil fremgå af datoen øverst på siden. Fortsat brug af ShelterDK
              efter en ændring udgør accept af de opdaterede vilkår.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
              Kontakt
            </h2>
            <p className="text-primary/80 leading-relaxed">
              Har du spørgsmål til vilkårene, kan du kontakte os via{" "}
              <Link
                href="/kontakt"
                className="text-accent underline hover:no-underline"
              >
                kontaktsiden
              </Link>
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
