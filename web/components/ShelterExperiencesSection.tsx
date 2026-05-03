"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { ExperienceUploadModal } from "@/components/ExperienceUploadModal";
import type { ShelterExperience } from "@/lib/experiences";

interface ShelterExperiencesSectionProps {
  shelterId: string;
  shelterSlug: string;
  shelterTitle: string;
}

export function ShelterExperiencesSection({
  shelterId,
  shelterSlug,
  shelterTitle,
}: ShelterExperiencesSectionProps) {
  const [experiences, setExperiences] = useState<ShelterExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/experiences?shelter_id=${shelterId}`)
      .then((r) => r.json())
      .then((d) => setExperiences(d.experiences ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shelterId]);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">Oplevelser</h2>
          {!loading && experiences.length > 0 && (
            <p className="text-sm text-primary/50 mt-0.5">{experiences.length} besøg delt</p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent/90 transition-colors touch-manipulation"
        >
          <Camera size={15} />
          Del din oplevelse
        </button>
      </div>

      {loading && (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-48 h-36 rounded-xl bg-primary/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && experiences.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {experiences.map((exp) => {
            const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
            const extra = exp.photo_urls.length - 1;
            return (
              <div
                key={exp.id}
                className="flex-shrink-0 w-48 rounded-xl overflow-hidden border border-primary/10 bg-white"
              >
                {coverUrl ? (
                  <div className="relative h-28">
                    <img
                      src={coverUrl}
                      alt={`Billede delt af ${exp.author_name} fra ${shelterTitle}`}
                      className="w-full h-full object-cover"
                    />
                    {extra > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        +{extra}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-28 bg-primary/5 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-primary/20" />
                  </div>
                )}
                <div className="p-2.5">
                  <div className="text-xs font-semibold text-primary mb-0.5">{exp.author_name}</div>
                  <div className="text-xs text-primary/60 italic line-clamp-2">&ldquo;{exp.body}&rdquo;</div>
                  <div className="text-[10px] text-primary/30 mt-1.5">
                    {new Date(exp.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {modalOpen && (
        <ExperienceUploadModal
          shelterId={shelterId}
          shelterSlug={shelterSlug}
          shelterTitle={shelterTitle}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}
