import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAreaBySlug, getSheltersByAreaSlug } from "@/lib/area-db";
import { EmbedMapClient } from "./EmbedMapClient";

const BRAND = "ShelterDK";

interface PageProps {
  params: Promise<{ areaSlug: string }>;
}

export const revalidate = 86400; // ISR: cache 24 timer

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { areaSlug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return { title: "Område ikke fundet" };
  return {
    title: `Shelter-kort ${area.name} | ${BRAND}`,
    robots: "noindex, nofollow",
  };
}

export default async function EmbedAreaMapPage({ params }: PageProps) {
  const { areaSlug } = await params;
  const [area, shelters] = await Promise.all([
    getAreaBySlug(areaSlug),
    getSheltersByAreaSlug(areaSlug),
  ]);

  if (!area) notFound();

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
      <EmbedMapClient shelters={shelters} areaName={area.name} />
      <Link
        href="https://shelterdk.dk"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 z-[1000] rounded px-2 py-1 text-xs text-white/80 bg-black/40 hover:bg-black/55 transition-colors backdrop-blur-sm"
        aria-label="Leveret af ShelterDK – åbn forsiden i ny fane"
      >
        Leveret af {BRAND}
      </Link>
    </div>
  );
}
