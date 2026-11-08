import { GuideTeaserLink } from "@/components/GuideTeaserLink";
import Link from "next/link";
import type { GuideKilde, GuideLink } from "@/lib/guide-links";

/**
 * Blok med interne links til koebsguiderne (/bedste), til de sidetyper der har
 * trafik men ingen in-content links derind.
 *
 * Maalt paa produktion 8. november 2026 havde hver af sitets sider fem links
 * til /bedste i footeren, og de fire guide-links dér er de samme paa hver
 * side. Site-wide footer-links rabatterer Google haardt, og 43 af de 47
 * guider havde ikke ét. In-content var tallene:
 *
 *   /                      4.029 klik/90d   0 links
 *   /by/koebenhavn           413            0
 *   /danmark/fyn             178            0
 *   /shelter-med-toilet      165            0
 *   /omraade/bornholm        141            0
 *   /koeb-shelter            131            1 (kun hubben)
 *   /guides                    -            0
 *   shelter-detalje            -            3
 *
 * Shelter-siderne var altsaa den eneste sidetype der linkede ind i guiderne,
 * og 47 guider paa snitposition 10 er et positionsproblem, ikke et
 * daekningsproblem.
 *
 * Blokken rendres ikke uden links, saa en afpubliceret guide eller et nede
 * Supabase giver en side uden blok frem for en tom ramme.
 */
export function GuideTeaser({
  guides,
  kilde,
  variant = "liste",
  heading,
  intro,
  visAlleLink = false,
}: {
  guides: GuideLink[];
  kilde: GuideKilde;
  variant?: "liste" | "kort";
  heading: string;
  intro?: string;
  /** Link til /bedste-hubben under blokken. */
  visAlleLink?: boolean;
}) {
  if (guides.length === 0) return null;

  const id = `guide-teaser-${kilde}`;

  if (variant === "kort") {
    return (
      <section className="bg-primary/[0.03] py-8" aria-labelledby={id}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id={id} className="mb-2 text-center font-serif text-3xl font-bold text-primary">
            {heading}
          </h2>
          {intro && (
            <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-primary/70">
              {intro}
            </p>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {guides.map((g) => (
              <GuideTeaserLink key={g.slug} guide={g} kilde={kilde} variant="kort" />
            ))}
          </div>
          {visAlleLink && (
            <p className="mt-6 text-center">
              <Link
                href="/bedste"
                className="text-sm font-semibold text-accent-dark hover:underline"
              >
                Se alle købsguider
              </Link>
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={id}
      className="mb-10 rounded-xl border border-accent/30 bg-accent/[0.07] p-5"
    >
      <h2 id={id} className="mb-1 font-serif text-lg font-bold text-primary">
        {heading}
      </h2>
      {intro && <p className="mb-4 text-sm text-primary/70">{intro}</p>}
      <ul className={intro ? "space-y-2" : "mt-4 space-y-2"}>
        {guides.map((g) => (
          <li key={g.slug}>
            <GuideTeaserLink guide={g} kilde={kilde} />
          </li>
        ))}
      </ul>
      {visAlleLink && (
        <p className="mt-3 text-sm">
          <Link href="/bedste" className="font-semibold text-accent-dark hover:underline">
            Se alle købsguider
          </Link>
        </p>
      )}
    </section>
  );
}
