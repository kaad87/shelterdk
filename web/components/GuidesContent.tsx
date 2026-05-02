"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search, Star } from "lucide-react";
import type { Guide, GuideCategory } from "@/data/guides";
import { useInView } from "@/lib/useInView";
import { slugifySegment } from "@/lib/slug";

function AnimatedCard({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const { ref, isInView } = useInView();
  return (
    <div
      ref={ref}
      className={isInView ? "animate-fade-in-up" : undefined}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {children}
    </div>
  );
}

function GuideCard({ guide, index }: { guide: Guide; index: number }) {
  return (
    <AnimatedCard index={index}>
      <article className="group rounded-2xl overflow-hidden border border-primary/10 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
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
            />
            <span className="absolute top-3 left-3 bg-accent text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {guide.category}
            </span>
          </div>
          <div className="flex-1 flex flex-col p-5 gap-3">
            <h3 className="font-serif text-xl font-bold text-primary">
              {guide.title}
            </h3>
            <p className="text-sm text-primary/80 flex-1 line-clamp-2">
              {guide.excerpt}
            </p>
            <span className="inline-flex items-center gap-1 text-accent font-semibold text-sm group-hover:underline">
              Læs guiden
              <span aria-hidden>→</span>
            </span>
          </div>
        </Link>
      </article>
    </AnimatedCard>
  );
}

function PopularGuideCard({ guide }: { guide: Guide }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex gap-4 items-center rounded-xl border border-primary/10 bg-white p-3 hover:shadow-md transition-shadow"
    >
      <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-primary/10">
        <Image
          src={guide.coverImage}
          alt={guide.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="80px"
        />
      </div>
      <div className="min-w-0">
        <h4 className="font-serif text-sm font-bold text-primary group-hover:text-accent transition-colors line-clamp-2">
          {guide.title}
        </h4>
        <span className="text-accent text-xs font-medium">{guide.category}</span>
      </div>
    </Link>
  );
}

interface GuidesContentProps {
  guides: Guide[];
  categories: GuideCategory[];
  activeCategory?: GuideCategory | null;
}

export function GuidesContent({
  guides,
  categories,
  activeCategory = null,
}: GuidesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGuides = useMemo(() => {
    let result = guides;

    if (activeCategory) {
      result = result.filter((guide) => guide.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (guide) =>
          guide.title.toLowerCase().includes(q) ||
          guide.excerpt.toLowerCase().includes(q)
      );
    }

    return result;
  }, [guides, activeCategory, searchQuery]);

  const showPopular = !activeCategory && !searchQuery.trim();
  const popularGuides = guides.slice(0, 3);

  return (
    <div className="flex gap-8">
      <aside className="hidden lg:block w-56 shrink-0">
        <nav className="sticky top-24">
          <h3 className="text-xs font-semibold text-primary/50 uppercase tracking-wider mb-3">
            Kategorier
          </h3>
          <ul className="space-y-1">
            <li>
              <Link
                href="/guides"
                className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === null
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-primary/70 hover:bg-primary/5 hover:text-primary"
                }`}
              >
                Alle guides
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category}>
                <Link
                  href={`/guides/kategori/${slugifySegment(category)}`}
                  className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-primary/70 hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="relative mb-8">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40"
          />
          <input
            type="text"
            placeholder="Søg i guides..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-primary/10 bg-white pl-11 pr-4 py-3 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-colors"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 lg:hidden scrollbar-hide">
          <Link
            href="/guides"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === null
                ? "bg-primary text-white"
                : "bg-white text-primary/70 border border-primary/10 hover:border-accent/30 hover:text-primary"
            }`}
          >
            Alle
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/guides/kategori/${slugifySegment(category)}`}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeCategory === category
                  ? "bg-primary text-white"
                  : "bg-white text-primary/70 border border-primary/10 hover:border-accent/30 hover:text-primary"
              }`}
            >
              {category}
            </Link>
          ))}
        </div>

        {showPopular && (
          <section className="mb-12">
            <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-primary mb-6">
              <Star size={20} className="text-accent" />
              Mest populære guides
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {popularGuides.map((guide) => (
                <PopularGuideCard key={guide.slug} guide={guide} />
              ))}
            </div>
          </section>
        )}

        <section aria-label="Liste over guider">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredGuides.map((guide, index) => (
              <GuideCard key={guide.slug} guide={guide} index={index} />
            ))}
          </div>

          {filteredGuides.length === 0 && (
            <p className="text-center text-primary/60 py-12">
              {searchQuery.trim()
                ? `Ingen guides matcher "${searchQuery}".`
                : "Ingen guides i denne kategori endnu."}
            </p>
          )}
        </section>

        <section className="mt-16">
          <div className="rounded-xl bg-primary text-white p-8 sm:p-10 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">
              Mangler du et shelter?
            </h2>
            <p className="text-white/80 mb-6 max-w-lg mx-auto">
              Søg på vores kort og find det perfekte shelter til din næste tur.
            </p>
            <Link
              href="/soeg"
              className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-full font-medium hover:bg-accent/90 transition-colors"
            >
              Søg på kortet
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
