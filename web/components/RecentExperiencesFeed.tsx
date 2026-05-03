"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ShelterExperienceWithShelter } from "@/lib/experiences";

export function RecentExperiencesFeed() {
  const [experiences, setExperiences] = useState<ShelterExperienceWithShelter[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/experiences/recent?limit=8")
      .then((r) => r.json())
      .then((d) => {
        setExperiences(d.experiences ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Don't render section if no experiences yet
  if (loaded && experiences.length === 0) return null;

  return (
    <section className="py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-primary">Seneste oplevelser</h2>
            <p className="text-sm text-primary/50 mt-0.5">Hvad andre har oplevet denne uge</p>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {!loaded
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-52 rounded-xl bg-primary/5 animate-pulse h-44" />
              ))
            : experiences.map((exp) => {
                const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
                const shelter = exp.shelter as { title: string; slug: string } | null;
                return (
                  <Link
                    key={exp.id}
                    href={shelter ? `/shelter/${shelter.slug}` : "/soeg"}
                    className="flex-shrink-0 w-52 rounded-xl overflow-hidden border border-primary/10 bg-white hover:shadow-md transition-shadow"
                  >
                    {coverUrl ? (
                      <div className="h-28 relative">
                        <img
                          src={coverUrl}
                          alt={`Billede delt fra ${shelter?.title ?? "shelteroplevelse"}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-2 left-2.5 right-2.5">
                          <div className="text-[10px] text-white/80">📍 {shelter?.title ?? "Shelter"}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-primary/5 flex items-center justify-center">
                        <div className="text-xs text-primary/30">📷</div>
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-xs italic text-primary/60 line-clamp-2">&ldquo;{exp.body}&rdquo;</div>
                      <div className="text-[10px] text-primary/30 mt-1.5">
                        {exp.author_name} · {new Date(exp.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
