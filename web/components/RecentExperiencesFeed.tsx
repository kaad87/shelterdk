import Image from "next/image";
import Link from "next/link";
import { createPublicClient } from "@/utils/supabase/server-public";

const RECENT_EXPERIENCES_LIMIT = 8;

interface RecentExperienceFeedItem {
  id: string;
  author_name: string;
  body: string;
  photo_urls: string[];
  cover_photo_index: number;
  created_at: string;
  shelter: { title: string; slug: string }[] | { title: string; slug: string } | null;
}

async function getRecentExperiences(
  limit: number = RECENT_EXPERIENCES_LIMIT
): Promise<RecentExperienceFeedItem[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("shelter_experiences")
      .select("id, author_name, body, photo_urls, cover_photo_index, created_at, shelter:shelters(title, slug)")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data ?? []) as unknown as RecentExperienceFeedItem[];
  } catch {
    return [];
  }
}

export async function RecentExperiencesFeed() {
  const experiences = await getRecentExperiences();

  if (experiences.length === 0) return null;

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
          {experiences.map((exp) => {
            const coverUrl = exp.photo_urls?.[exp.cover_photo_index];
            const shelter = Array.isArray(exp.shelter) ? (exp.shelter[0] ?? null) : exp.shelter;
            return (
              <Link
                key={exp.id}
                href={shelter ? `/shelter/${shelter.slug}` : "/soeg"}
                className="flex-shrink-0 w-52 rounded-xl overflow-hidden border border-primary/10 bg-white hover:shadow-md transition-shadow"
              >
                {coverUrl ? (
                  <div className="h-28 relative">
                    <Image
                      src={coverUrl}
                      alt={`Billede delt fra ${shelter?.title ?? "shelteroplevelse"}`}
                      fill
                      sizes="208px"
                      className="object-cover"
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
