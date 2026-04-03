import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import { getTotalShelterCount, getFacilityCounts, getCountPerRegion, getTopRatedShelters } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;
const CANONICAL = "/fakta/gratis-shelters";

export async function generateMetadata(): Promise<Metadata> {
  const facilities = await getFacilityCounts();
  const title = `Gratis shelters i Danmark \u2013 ${facilities.gratis} shelters uden betaling | ShelterDK`;
  const description = `${facilities.gratis} shelters i Danmark er helt gratis. Se oversigt over gratis vs. betalte shelters fordelt p\u00e5 regioner.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL },
    robots: { index: true, follow: true },
  };
}

export default async function GratisSheltersPage() {
  const [total, facilities, regions, topShelters] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getCountPerRegion(),
    getTopRatedShelters(6),
  ]);

  const paidCount = total - facilities.gratis;
  const freePercent = total > 0 ? Math.round((facilities.gratis / total) * 100) : 0;

  return (
    <FaktaPage
      title="Gratis shelters i Danmark"
      heroStat={`${facilities.gratis} ud af ${total} shelters er gratis (${freePercent}%)`}
      summary={`${facilities.gratis} shelters i Danmark er helt gratis at benytte efter f\u00f8rst-til-m\u00f8lle-princippet. De resterende ${paidCount} shelters kan kr\u00e6ve booking eller et mindre gebyr. ${facilities.bookbar} shelters kan bookes via udinaturen.dk eller Naturstyrelsen.`}
      breakdownTitle="Shelters per region"
      breakdownRows={regions.map((r) => ({
        label: r.region,
        value: r.count,
        href: `/danmark/${slugifySegment(r.region)}`,
      }))}
      topSheltersTitle="H\u00f8jest bed\u00f8mte gratis shelters"
      topShelters={topShelters}
      faqItems={[
        { question: "Er shelters i Danmark gratis?", answer: `Ja, ${facilities.gratis} ud af ${total} shelters (${freePercent}%) er helt gratis. De fungerer efter f\u00f8rst-til-m\u00f8lle-princippet.` },
        { question: "Hvad koster det at overnatte i shelter?", answer: `Gratis shelters koster intet. Bookbare shelters koster typisk 30-100 kr. per nat. ${facilities.bookbar} shelters kan bookes.` },
        { question: "Hvad betyder f\u00f8rst-til-m\u00f8lle?", answer: "F\u00f8rst-til-m\u00f8lle betyder at pladsen ikke kan reserveres. Den der kommer f\u00f8rst, har ret til at overnatte." },
        { question: "Kan man booke gratis shelters?", answer: "Nej, gratis shelters er per definition f\u00f8rst-til-m\u00f8lle. \u00d8nsker du at reservere, skal du finde et bookbart shelter." },
        { question: "Hvor finder man gratis shelters?", answer: `Brug ShelterDK's s\u00f8gning med filteret 'Gratis' for at finde alle ${facilities.gratis} gratis shelters p\u00e5 kort og liste.` },
      ]}
      relatedLinks={[
        { label: "Shelters i Danmark", href: "/fakta/shelters-i-danmark" },
        { label: "Gratis shelters guide", href: "/blog/gratis-shelters-i-danmark" },
        { label: "Bedste shelters", href: "/fakta/bedste-shelters" },
        { label: "Faciliteter", href: "/fakta/shelters-med-faciliteter" },
        { label: "Book shelter", href: "/shelter-booking" },
        { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
        { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
      ]}
      datasetName="Gratis shelters i Danmark"
      datasetDescription={`Oversigt over ${facilities.gratis} gratis shelters i Danmark`}
      canonicalPath={CANONICAL}
      variableMeasured={["free shelter count", "paid shelter count", "booking availability"]}
    />
  );
}
