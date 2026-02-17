import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAreaBySlug, getShelterCountByAreaSlug } from "@/lib/area-db";
import { createPublicClient } from "@/utils/supabase/server-public";

const BRAND = "ShelterDK";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;

/** Statisk generer kendte områder; resten on-demand. */
export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("areas").select("slug");
  if (!data?.length) return [];
  return data.map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) return { title: "Område ikke fundet" };

  const title = `Shelter på ${area.name} – Se kort og book her | ${BRAND}`;
  const description =
    area.description?.slice(0, 155) ||
    `Find shelters i ${area.name}. Se kort, billeder og book muligheder for naturovernatning.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title: `Shelter på ${area.name} | ${BRAND}`,
      description,
      siteName: BRAND,
      type: "website",
      url: `https://shelterdk.dk/omraade/${slug}`,
    },
    alternates: { canonical: `https://shelterdk.dk/omraade/${slug}` },
  };
}

export default async function OmraadePage({ params }: PageProps) {
  const { slug } = await params;
  const [area, shelterCount] = await Promise.all([
    getAreaBySlug(slug),
    getShelterCountByAreaSlug(slug),
  ]);

  if (!area) notFound();

  return (
    <main className="min-h-screen bg-background" id="main-content">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2"
          aria-label="Brødkrumme"
        >
          <Link
            href="/"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Forside
          </Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" aria-hidden />
          <Link
            href="/omraade"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Områder
          </Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" aria-hidden />
          <span className="text-primary font-medium truncate">{area.name}</span>
        </nav>

        <header className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary leading-tight">
            Find det perfekte shelter på {area.name} (Kort og Overblik)
          </h1>
        </header>

        <section aria-labelledby="beskrivelse-heading" className="mb-10">
          <h2 id="beskrivelse-heading" className="sr-only">
            Om området
          </h2>
          {area.description ? (
            <p className="text-primary/90 text-lg leading-relaxed">{area.description}</p>
          ) : (
            <p className="text-primary/80">
              Udforsk shelters og naturovernatning i {area.name}. Se kort, læs om
              pladserne og find bookbare shelters.
            </p>
          )}
        </section>

        <section aria-labelledby="shelters-cta-heading" className="border-t border-primary/10 pt-8">
          <h2 id="shelters-cta-heading" className="font-serif text-xl font-semibold text-primary mb-2">
            Shelters i området
          </h2>
          <p className="text-primary/80 mb-4">
            {shelterCount === 0
              ? "Der er endnu ikke tilføjet shelters til dette område."
              : shelterCount === 1
                ? "1 shelter er registreret i dette område."
                : `${shelterCount} shelters er registreret i dette område.`}
          </p>
          {shelterCount > 0 && (
            <Link
              href={`/soeg?area=${encodeURIComponent(slug)}`}
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded px-1 -mx-1"
            >
              Se shelters på kort og i liste
              <ChevronRight size={18} className="shrink-0" aria-hidden />
            </Link>
          )}
        </section>

        <section className="border-t border-primary/10 pt-8 mt-10">
          <h2 className="sr-only">Andre områder</h2>
          <p className="text-primary/80 mb-2">
            Udforsk shelters i andre dele af Danmark.
          </p>
          <Link
            href="/omraade"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded px-1 -mx-1"
          >
            Se alle områder
            <ChevronRight size={18} className="shrink-0" aria-hidden />
          </Link>
        </section>
      </div>
    </main>
  );
}
