import type { Metadata } from "next";
import Link from "next/link";
import { getAllAreas } from "@/lib/area-db";
import { getShelterCountByAreaSlug } from "@/lib/area-db";

const BRAND = "ShelterDK";

export const revalidate = 86400;

const PAGE_TITLE = `Shelter efter område – Find naturovernatning i Danmark | ${BRAND}`;
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Udforsk shelters efter område: Fyn, Sjælland, Jylland. Se kort, billeder og book muligheder for naturovernatning.",
  openGraph: {
    title: PAGE_TITLE,
    description: "Udforsk shelters efter område: Fyn, Sjælland, Jylland. Se kort, billeder og book muligheder for naturovernatning.",
    siteName: BRAND,
    type: "website",
    url: "/omraade",
  },
  alternates: { canonical: "https://shelterdk.dk/omraade" },
};

export default async function OmraadeIndexPage() {
  const areas = await getAllAreas();
  const counts = await Promise.all(
    areas.map((a) => getShelterCountByAreaSlug(a.slug))
  );
  const areasWithCount = areas.map((area, i) => ({
    ...area,
    shelterCount: counts[i] ?? 0,
  }));

  return (
    <main className="min-h-screen bg-background" id="main-content">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <nav className="mb-8 text-sm text-primary/70" aria-label="Brødkrummesti">
          <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
            <li>
              <Link href="/" className="hover:text-accent transition-colors">
                Forside
              </Link>
            </li>
            <li aria-hidden className="text-primary/50">
              /
            </li>
            <li className="text-primary font-medium">Områder</li>
          </ol>
        </nav>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-4">
          Shelter efter område
        </h1>
        <p className="text-primary/80 mb-10">
          Vælg et område og find shelters med kort, billeder og book muligheder.{" "}
          <Link href="/soeg" className="text-accent font-medium hover:underline">
            Søg alle shelters
          </Link>
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none m-0 p-0">
          {areasWithCount.map((area) => (
            <li key={area.slug}>
              <Link
                href={`/omraade/${area.slug}`}
                className="block rounded-xl border border-primary/15 bg-card px-5 py-4 hover:border-accent/40 hover:bg-primary/5 transition-colors"
              >
                <span className="font-semibold text-primary">{area.name}</span>
                {area.shelterCount > 0 && (
                  <span className="ml-2 text-sm text-primary/60">
                    ({area.shelterCount} shelter{area.shelterCount !== 1 ? "s" : ""})
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {areasWithCount.length === 0 && (
          <p className="text-primary/70">Ingen områder fundet.</p>
        )}
      </div>
    </main>
  );
}
