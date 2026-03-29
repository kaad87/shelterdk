import type { Metadata } from "next";
import { Suspense } from "react";
import * as fs from "fs";
import * as path from "path";
import { CuratedRoutesClient } from "@/components/CuratedRoutesClient";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import type { CuratedRouteIndex } from "@/types/curated-route";

export const metadata: Metadata = {
  title: "Vandreruter med shelters — Udforsk Danmarks bedste vandreruter",
  description:
    "Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen. Filtrer efter region og længde, og download GPX til din næste vandretur.",
  alternates: { canonical: "https://shelterdk.dk/ruteplanner" },
  openGraph: {
    title: "Vandreruter med shelters | ShelterDK",
    description:
      "Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen. Filtrer efter region og længde, og download GPX til din næste vandretur.",
    url: "/ruteplanner",
  },
};

export default function RutePlannerPage() {
  let index: CuratedRouteIndex[] = [];
  try {
    const filePath = path.join(process.cwd(), "public/data/curated-routes-index.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    index = JSON.parse(raw);
  } catch {
    // fallback to empty
  }

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Vandreruter" }]} />
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-background">
          <span className="text-primary/40 text-sm">Indlæser vandreruter...</span>
        </div>
      }
    >
      <CuratedRoutesClient initialIndex={index} />
    </Suspense>
    </>
  );
}
