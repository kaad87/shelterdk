import type { Metadata } from "next";
import { Suspense } from "react";
import { createPublicClient } from "@/utils/supabase/server-public";
import { RoutePlannerClient } from "@/components/RoutePlannerClient";

export const metadata: Metadata = {
  title: "Ruteplanner - Planlæg din shelter-vandring",
  description:
    "Planlæg din vandrerute mellem shelters i Danmark. Se vandreruter, beregn afstande og download GPX.",
};

export default async function RutePlannerPage() {
  const supabase = createPublicClient();

  const allShelters = [];
  let from = 0;
  const BATCH = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("id, slug, title, location, capacity, water, toilet")
      .is("duplicate_of_shelter_id", null)
      .not("location", "is", null)
      .range(from, from + BATCH - 1);

    if (error || !data || data.length === 0) break;
    allShelters.push(...data);
    if (data.length < BATCH) break;
    from += BATCH;
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-background">
          <span className="text-primary/40 text-sm">Indlæser ruteplanner...</span>
        </div>
      }
    >
      <RoutePlannerClient shelters={allShelters} />
    </Suspense>
  );
}
