import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const metadata: Metadata = {
  title: { absolute: "Vilkår og betingelser | ShelterDK" },
  description:
    "Læs vilkår og betingelser for brug af ShelterDKs website, bookingflow og ejerportal.",
  alternates: { canonical: "https://shelterdk.dk/vilkaar" },
  openGraph: {
    title: "Vilkår og betingelser | ShelterDK",
    description:
      "Læs vilkår og betingelser for brug af ShelterDKs website, bookingflow og ejerportal.",
    url: "/vilkaar",
  },
};

export default function VilkaarPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Vilkår og betingelser" }]} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <header className="mb-12">
            <h1 className="font-serif text-4xl font-bold text-primary mb-4">
              Vilkår og betingelser
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Disse vilkår gælder for brug af ShelterDK, herunder søgning på siden,
              bookingforløb og ejerportal.
            </p>
            <p className="text-primary/50 text-sm mt-3">Senest opdateret: 9. maj 2026</p>
          </header>

          <div className="prose prose-primary max-w-none space-y-10">
            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Hvem vi er</h2>
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
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Om tjenesten</h2>
              <p className="text-primary/80 leading-relaxed">
                ShelterDK samler information om shelters i Danmark og tilbyder i nogle tilfælde et
                digitalt bookingsystem for udvalgte shelters. ShelterDK fungerer som platform og
                teknisk formidler. Selve shelteret drives, vedligeholdes og stilles til rådighed af
                den enkelte shelter-ejer eller forvalter.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Booking og betaling
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Når du booker via ShelterDK, accepterer du, at din booking oprettes i ShelterDKs
                system, og at de nødvendige oplysninger videregives til shelter-ejeren for at kunne
                gennemføre opholdet.
              </p>
              <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
                <li>
                  For de shelters, der er omfattet af denne model, betaler gæsten et{" "}
                  <strong>administrationsgebyr på 50 kr. inkl. moms</strong> pr. gennemført
                  booking.
                </li>
                <li>
                  Betalingen sker til <strong>CKA Media</strong> via ShelterDKs betalingsflow.
                </li>
                <li>
                  Shelter-ejeren modtager ikke dette administrationsgebyr som lejeindtægt.
                </li>
                <li>
                  Hvor det fremgår af bookingflowet, kan en booking enten bekræftes automatisk ved
                  betaling eller først efter shelter-ejerens accept.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Aflysninger og refusion
              </h2>
              <ul className="list-disc pl-6 text-primary/80 space-y-3 mt-3">
                <li>
                  Hvis gæsten aflyser <strong>mere end 24 timer</strong> før ankomst, refunderes
                  administrationsgebyret fuldt ud.
                </li>
                <li>
                  Hvis gæsten aflyser <strong>mindre end 24 timer</strong> før ankomst eller
                  udebliver, refunderes administrationsgebyret som udgangspunkt ikke.
                </li>
                <li>
                  Hvis shelter-ejeren aflyser bookingen, refunderes administrationsgebyret altid
                  fuldt ud.
                </li>
              </ul>
              <p className="text-primary/80 leading-relaxed mt-4">
                Hvis der på en konkret booking gælder en anden aflysningsfrist, vil det fremgå
                tydeligt i bookingflowet eller i shelter-ejerens opsætning.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Shelter-ejerens ansvar
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Shelter-ejeren er ansvarlig for oplysninger om shelteret, den fysiske plads,
                adgangsforhold, vedligeholdelse, sikkerhed og eventuelle lokale regler. ShelterDK
                kan ikke garantere, at et shelter er i en bestemt stand eller lever op til en
                bestemt forventning.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Gæstens ansvar
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Som gæst er du ansvarlig for at give korrekte oplysninger ved booking, overholde
                lokale regler og bruge shelteret på forsvarlig vis. Gæsten er ansvarlig for eget
                ophold, udstyr og adfærd på pladsen.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Ansvarsbegrænsning
              </h2>
              <p className="text-primary/80 leading-relaxed">
                ShelterDK fungerer som teknisk platform og formidler og er ikke ansvarlig for
                personskade, tyveri, hærværk, vejrlig, fejl i lokale oplysninger eller andre
                forhold på selve shelterpladsen. Vi bestræber os på stabil drift, men garanterer
                ikke uafbrudt adgang til siden eller bookingsystemet.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Data og privatliv
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Når du bruger ShelterDK, behandler vi personoplysninger i overensstemmelse med
                vores{" "}
                <Link href="/privacy" className="text-accent underline hover:no-underline">
                  privatlivs- og cookiepolitik
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">
                Immaterielle rettigheder
              </h2>
              <p className="text-primary/80 leading-relaxed">
                Design, tekster og egenudviklet indhold på ShelterDK tilhører ShelterDK eller de
                respektive rettighedshavere. Offentlige shelterdata og tredjepartsbilleder er
                underlagt deres respektive licenser og vilkår.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-2xl font-bold text-primary mt-8 mb-4">Ændringer</h2>
              <p className="text-primary/80 leading-relaxed">
                Vi kan opdatere disse vilkår løbende. Ved væsentlige ændringer opdaterer vi datoen
                øverst på siden. Fortsat brug af bookingflowet eller tjenesten efter en ændring
                anses som accept af de opdaterede vilkår.
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
