import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import {
  getTotalShelterCount,
  getCountPerRegion,
  getTopRatedShelters,
  getFacilityCounts,
  getAverageRating,
} from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";
import { canonicalRegionSlug } from "@/lib/cross-page-config";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

export const revalidate = 86400;

const CANONICAL = "/fakta/shelters-i-danmark";

export async function generateMetadata(): Promise<Metadata> {
  const total = await getTotalShelterCount();
  const title = `Shelters i Danmark \u2013 ${total} p\u00e5 kort & liste | ShelterDK`;
  const description = `Der er ${total} shelters i Danmark. Se komplet statistik over regioner, faciliteter og bed\u00f8mmelser. Opdateret data fra GeoFA, Naturstyrelsen og udinaturen.dk.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL, images: [DEFAULT_OG_IMAGE] },
    robots: { index: true, follow: true },
  };
}

export default async function SheltersIDanmarkPage() {
  const [total, regions, topShelters, facilities, avgRating] = await Promise.all([
    getTotalShelterCount(),
    getCountPerRegion(),
    getTopRatedShelters(6),
    getFacilityCounts(),
    getAverageRating(),
  ]);

  return (
    <FaktaPage
      title="Shelters i Danmark"
      heroStat={`Der er ${total.toLocaleString("da-DK")} shelters i Danmark`}
      summary={`Danmark har ${total.toLocaleString("da-DK")} registrerede shelters fordelt p\u00e5 ${regions.length} regioner. ${regions[0]?.region ?? "Jylland"} har flest med ${regions[0]?.count ?? 0} shelters. ${facilities.gratis} shelters er gratis, og ${facilities.toilet} har toilet.${avgRating ? ` Den gennemsnitlige Google-bed\u00f8mmelse er ${avgRating} ud af 5.` : ""}`}
      breakdownTitle="Shelters per region"
      breakdownRows={regions.map((r) => ({
        label: r.region,
        value: r.count,
        href: `/danmark/${canonicalRegionSlug(r.region)}`,
      }))}
      topSheltersTitle="Højest bedømte shelters i Danmark"
      topShelters={topShelters}
      faqItems={[
        { question: "Hvor mange shelters er der i Danmark?", answer: `Der er ${total} shelters registreret i Danmark p\u00e5 ShelterDK. Data stammer fra GeoFA, Naturstyrelsen og udinaturen.dk.` },
        { question: "Hvilken region har flest shelters?", answer: `${regions[0]?.region ?? "Jylland"} har flest shelters med ${regions[0]?.count ?? 0}, efterfulgt af ${regions[1]?.region ?? "Sj\u00e6lland"} (${regions[1]?.count ?? 0}) og ${regions[2]?.region ?? "Fyn"} (${regions[2]?.count ?? 0}).` },
        { question: "Er shelters i Danmark gratis?", answer: `${facilities.gratis} ud af ${total} shelters er gratis (f\u00f8rst-til-m\u00f8lle). De \u00f8vrige kan kr\u00e6ve booking eller et mindre gebyr.` },
        { question: "Hvor mange shelters har toilet?", answer: `${facilities.toilet} shelters i Danmark har toilet (vandskyllende eller muldtoilet).` },
        { question: "Kan man booke et shelter i Danmark?", answer: `Ja, ${facilities.bookbar} shelters kan bookes p\u00e5 forh\u00e5nd via udinaturen.dk eller book.naturstyrelsen.dk.` },
        { question: "Hvad er den gennemsnitlige bed\u00f8mmelse?", answer: avgRating ? `Den gennemsnitlige Google-bed\u00f8mmelse for shelters i Danmark er ${avgRating} ud af 5.` : "Vi har endnu ikke nok data til at beregne en samlet gennemsnitsbed\u00f8mmelse." },
      ]}
      relatedLinks={[
        { label: "Bedste shelters", href: "/fakta/bedste-shelters" },
        { label: "Gratis shelters", href: "/fakta/gratis-shelters" },
        { label: "Faciliteter", href: "/fakta/shelters-med-faciliteter" },
        { label: "Nationalparker", href: "/fakta/shelters-i-nationalparker" },
        { label: "Shelter til cykeltur", href: "/shelter-til-cykeltur" },
        { label: "Shelter nær vand", href: "/shelter-naer-vand" },
        { label: "Shelter til familier", href: "/shelter-til-familier" },
        { label: "Handicapvenlige shelters", href: "/handicapvenlige-shelters" },
        { label: "Guide for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
        { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
        { label: "De bedste regioner", href: "/blog/de-bedste-regioner" },
        { label: "Shelter vs. teltplads", href: "/blog/shelter-vs-teltplads" },
      ]}
      datasetName="Shelters i Danmark - Komplet statistik"
      datasetDescription={`Opdateret statistik over alle ${total} shelters i Danmark`}
      canonicalPath={CANONICAL}
      variableMeasured={["shelter count", "facility availability", "Google rating"]}
    />
  );
}
