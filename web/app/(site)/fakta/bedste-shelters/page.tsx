import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import { getTopRatedShelters, getAverageRating, getTotalShelterCount } from "@/lib/fakta-db";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

export const revalidate = 86400;
const CANONICAL = "/fakta/bedste-shelters";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Bedst bed\u00f8mte shelters i Danmark (Google) | ShelterDK";
  const description = "Se Danmarks bedst bed\u00f8mte shelters baseret p\u00e5 Google-anmeldelser. Data-backed ranking med rigtige bed\u00f8mmelser.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL, images: [DEFAULT_OG_IMAGE] },
    robots: { index: true, follow: true },
  };
}

export default async function BedsteSheltersPage() {
  const [topShelters, avgRating, total] = await Promise.all([
    getTopRatedShelters(20, 3),
    getAverageRating(),
    getTotalShelterCount(),
  ]);

  return (
    <FaktaPage
      title="Bedste shelters i Danmark"
      heroStat={`Top ${topShelters.length} shelters rangeret efter Google-bed\u00f8mmelser`}
      summary={`Denne ranking er baseret p\u00e5 Google-anmeldelser fra rigtige bes\u00f8gende. Kun shelters med mindst 3 anmeldelser er inkluderet. Den gennemsnitlige bed\u00f8mmelse for alle ${total} shelters er ${avgRating ?? "ikke tilg\u00e6ngelig"} ud af 5.`}
      breakdownTitle="Top 20 shelters"
      breakdownRows={topShelters.map((s, i) => ({
        label: `${i + 1}. ${s.title}`,
        value: `${s.google_rating} \u2605 (${s.google_user_ratings_total} anm.)`,
      }))}
      topSheltersTitle="De 6 bedste shelters"
      topShelters={topShelters.slice(0, 6)}
      faqItems={[
        { question: "Hvad er det bedste shelter i Danmark?", answer: topShelters[0] ? `${topShelters[0].title} er det h\u00f8jest bed\u00f8mte shelter med en Google-bed\u00f8mmelse p\u00e5 ${topShelters[0].google_rating} baseret p\u00e5 ${topShelters[0].google_user_ratings_total} anmeldelser.` : "Se listen for den aktuelle nummer 1." },
        { question: "Hvordan rangeres shelters?", answer: "Rangering er baseret p\u00e5 Google-bed\u00f8mmelser fra rigtige bes\u00f8gende. Kun shelters med mindst 3 anmeldelser er inkluderet for at sikre p\u00e5lidelighed." },
        { question: "Hvad er den gennemsnitlige bed\u00f8mmelse?", answer: avgRating ? `Den gennemsnitlige Google-bed\u00f8mmelse for shelters i Danmark er ${avgRating} ud af 5.` : "Data er ikke tilg\u00e6ngelig endnu." },
        { question: "Hvor mange shelters har anmeldelser?", answer: `${topShelters.length}+ shelters har mindst 3 Google-anmeldelser, som bruges i denne ranking.` },
        { question: "Kan man booke de bedste shelters?", answer: "Nogle af de bedst bed\u00f8mte shelters kan bookes via udinaturen.dk. Se de individuelle sheltersider for bookingmuligheder." },
      ]}
      relatedLinks={[
        { label: "Shelters i Danmark", href: "/fakta/shelters-i-danmark" },
        { label: "De 10 bedste shelters (blog)", href: "/blog/de-10-bedste-shelters" },
        { label: "Gratis shelters", href: "/fakta/gratis-shelters" },
        { label: "Faciliteter", href: "/fakta/shelters-med-faciliteter" },
        { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
        { label: "De bedste regioner", href: "/blog/de-bedste-regioner" },
        { label: "Sådan vælger du shelter", href: "/guides/saadan-finder-du-det-perfekte-shelter" },
      ]}
      datasetName="Bedste shelters i Danmark - Ranking"
      datasetDescription="Top-rated shelters baseret på Google-anmeldelser"
      canonicalPath={CANONICAL}
      variableMeasured={["Google rating", "review count"]}
    />
  );
}
