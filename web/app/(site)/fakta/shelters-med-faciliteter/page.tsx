import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import { getTotalShelterCount, getFacilityCounts, getTopRatedShelters } from "@/lib/fakta-db";

export const revalidate = 86400;
const CANONICAL = "/fakta/shelters-med-faciliteter";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Faciliteter p\u00e5 shelters i Danmark \u2013 toilet, vand, b\u00e5lplads | ShelterDK";
  const description = "Komplet oversigt over faciliteter p\u00e5 shelters i Danmark. Se hvor mange shelters der har toilet, vand, b\u00e5lplads, og mere.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL },
    robots: { index: true, follow: true },
  };
}

export default async function FaciliteterPage() {
  const [total, facilities, topShelters] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getTopRatedShelters(6),
  ]);

  return (
    <FaktaPage
      title="Faciliteter p\u00e5 shelters i Danmark"
      heroStat={`${facilities.toilet} ud af ${total} shelters har toilet`}
      summary={`Shelter-faciliteter varierer meget i Danmark. ${facilities.toilet} shelters har toilet, ${facilities.water} har vand, ${facilities.baalplads} har b\u00e5lplads, og ${facilities.hund} tillader hund. ${facilities.bruser} har bruser og ${facilities.strand} ligger n\u00e6r strand.`}
      breakdownTitle="Faciliteter i tal"
      breakdownRows={[
        { label: "Toilet (vandskyllende/muldtoilet)", value: facilities.toilet, href: "/shelter-med-toilet" },
        { label: "Drikkevand", value: facilities.water, href: "/shelter-med-vand" },
        { label: "B\u00e5lplads", value: facilities.baalplads, href: "/shelter-med-baalplads" },
        { label: "Hund tilladt", value: facilities.hund, href: "/shelter-med-hund" },
        { label: "N\u00e6r strand", value: facilities.strand, href: "/shelter-med-strand" },
        { label: "Bruser/bad", value: facilities.bruser, href: "/shelter-med-bruser" },
        { label: "Kan bookes", value: facilities.bookbar, href: "/shelter-booking" },
        { label: "Gratis", value: facilities.gratis },
      ]}
      topSheltersTitle="H\u00f8jest bed\u00f8mte shelters med faciliteter"
      topShelters={topShelters}
      faqItems={[
        { question: "Hvilke faciliteter har shelters i Danmark?", answer: `De mest almindelige faciliteter er toilet (${facilities.toilet} shelters), drikkevand (${facilities.water}), b\u00e5lplads (${facilities.baalplads}) og hund tilladt (${facilities.hund}).` },
        { question: "Hvor mange shelters har toilet?", answer: `${facilities.toilet} shelters i Danmark har toilet \u2013 enten vandskyllende eller muldtoilet.` },
        { question: "Hvor mange shelters har drikkevand?", answer: `${facilities.water} shelters har adgang til drikkevand.` },
        { question: "Hvor mange shelters tillader hund?", answer: `${facilities.hund} shelters i Danmark tillader hund.` },
        { question: "Kan man finde shelters med bruser?", answer: `Ja, ${facilities.bruser} shelters har bruser eller bad.` },
      ]}
      relatedLinks={[
        { label: "Shelters i Danmark", href: "/fakta/shelters-i-danmark" },
        { label: "Gratis shelters", href: "/fakta/gratis-shelters" },
        { label: "Bedste shelters", href: "/fakta/bedste-shelters" },
        { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
        { label: "Sådan vælger du shelter", href: "/guides/saadan-finder-du-det-perfekte-shelter" },
        { label: "Udstyr for begyndere", href: "/blog/udstyr-guide-begyndere" },
      ]}
      datasetName="Facilitetsoversigt for shelters i Danmark"
      datasetDescription={`Facilitetsstatistik for ${total} shelters: toilet, vand, b\u00e5lplads og mere`}
      canonicalPath={CANONICAL}
      variableMeasured={["toilet count", "water count", "fire pit count", "pet-friendly count"]}
    />
  );
}
