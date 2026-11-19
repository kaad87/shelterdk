import Link from "next/link";
import { ExternalLink } from "lucide-react";

/**
 * Redaktionelle afsnit under en liste af shelters: overskrift, afsnit og en
 * linkliste. Bruges af tema-samlesiderne (lib/collection-pages.ts) og af
 * områdesiderne (lib/area-content.ts), saa de to ikke skal holdes i sync.
 */
export interface RedaktionelSektion {
  heading: string;
  paragraphs: string[];
  links?: { label: string; href: string; external?: boolean }[];
}

export function RedaktionelleSektioner({ sections }: { sections?: RedaktionelSektion[] }) {
  if (!sections || sections.length === 0) return null;
  return (
    <>
      {sections.map((sec) => (
        <section key={sec.heading} className="mb-10">
          <h2 className="font-serif text-2xl font-bold text-primary mb-4">{sec.heading}</h2>
          {sec.paragraphs.map((t) => (
            <p key={t.slice(0, 40)} className="text-primary/85 leading-relaxed mb-4">
              {t}
            </p>
          ))}
          {sec.links && sec.links.length > 0 && (
            <ul className="space-y-1 text-sm">
              {sec.links.map((l) =>
                l.external ? (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      {l.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </li>
                ) : (
                  <li key={l.href}>
                    <Link href={l.href} className="text-accent hover:underline">
                      {l.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
