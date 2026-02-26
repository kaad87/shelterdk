import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getGuides } from "@/data/guides";

const PAGE_TITLE = "Guides til shelters og naturovernatning | ShelterDK";
const PAGE_DESCRIPTION =
  "Få praktiske guides til shelters, udstyr og turplanlægning. Lær hvordan du vælger det rigtige shelter, pakker tasken og får mest muligt ud af overnatning i naturen.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/guides" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guides",
  },
};

export default function GuidesIndexPage() {
  const guides = getGuides();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-10">
          <p className="text-sm text-primary/70 mb-2">
            <Link href="/" className="hover:text-accent transition-colors">
              Hjem
            </Link>{" "}
            <span aria-hidden className="text-primary/40">
              /
            </span>{" "}
            <span className="text-primary font-medium">Guides</span>
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-3">
            Guides til shelters og naturovernatning
          </h1>
          <p className="text-primary/80 max-w-2xl">
            Dyk ned i praktiske guides om valg af shelter, pakkelister og tips til
            en god nat i det fri. Siden udbygges løbende, så du altid kan finde
            ny inspiration.
          </p>
        </header>

        <section
          aria-label="Liste over guider"
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {guides.map((guide) => (
            <article
              key={guide.slug}
              className="group rounded-2xl overflow-hidden border border-primary/10 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <Link
                href={`/guides/${guide.slug}`}
                className="flex flex-col flex-1 cursor-pointer outline-none focus:ring-2 focus:ring-accent focus:ring-inset focus:ring-offset-2 rounded-2xl"
              >
                <div className="relative h-52 w-full overflow-hidden bg-primary/10">
                  <Image
                    src={guide.coverImage}
                    alt={guide.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized
                  />
                </div>
                <div className="flex-1 flex flex-col p-5 gap-3">
                  <h2 className="font-serif text-xl font-bold text-primary">
                    {guide.title}
                  </h2>
                  <p className="text-sm text-primary/80 flex-1">{guide.excerpt}</p>
                  <span className="inline-flex items-center gap-1 text-accent font-semibold text-sm group-hover:underline">
                    Læs guiden
                    <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
