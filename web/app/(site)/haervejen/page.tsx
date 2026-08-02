import type { Metadata } from "next";
import { CollectionPage } from "@/components/CollectionPage";
import { COLLECTIONS, getCollectionShelters } from "@/lib/collection-pages";

const CONFIG = COLLECTIONS["haervejen"];

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const shelters = await getCollectionShelters("haervejen");
  const n = shelters.length;
  return {
    title: { absolute: CONFIG.titleTemplate(n) },
    description: CONFIG.description(n),
    alternates: { canonical: `https://shelterdk.dk/haervejen` },
    openGraph: {
      title: CONFIG.titleTemplate(n),
      description: CONFIG.description(n),
      url: `/haervejen`,
    },
    ...(n === 0 && { robots: { index: false, follow: true } }),
  };
}

export default async function Page() {
  const shelters = await getCollectionShelters("haervejen");
  return <CollectionPage config={CONFIG} shelters={shelters} />;
}
