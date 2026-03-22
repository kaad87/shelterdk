import type { Metadata } from "next";
import { Suspense } from "react";
import { CuratedRoutesClient } from "@/components/CuratedRoutesClient";
import type { CuratedRouteIndex } from "@/types/curated-route";
import routeIndex from "../../../public/data/curated-routes-index.json";

export const metadata: Metadata = {
  title: "Vandreruter med shelters — Udforsk Danmarks bedste vandreruter",
  description:
    "Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen. Filtrer efter region og længde, og download GPX til din næste vandretur.",
};

export default function RutePlannerPage() {
  const index = routeIndex as CuratedRouteIndex[];

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-background">
          <span className="text-primary/40 text-sm">Indlæser vandreruter...</span>
        </div>
      }
    >
      <CuratedRoutesClient initialIndex={index} />
    </Suspense>
  );
}
