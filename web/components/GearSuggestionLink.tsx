"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { trackGearSuggestionClick } from "@/lib/tracking";
import { gearSuggestionHref } from "@/lib/gear-suggestions";
import type { GuideLink } from "@/lib/gear-suggestions";

/**
 * Ét grej-forslag. Klientkomponent udelukkende for at kunne måle klikket —
 * blokken var den eneste store flade på sitet uden nogen form for tracking,
 * så vi kunne hverken se om nogen brugte den eller om en ændring hjalp.
 *
 * Stedets eget faktum står først og guidens titel under. Omvendt rækkefølge
 * gav en liste af produktkategorier, der lignede en annonce; begrundelsen er
 * det, der gør forslaget relevant lige her, så den bærer rækken.
 */
export function GearSuggestionLink({ guide, shelterSlug }: { guide: GuideLink; shelterSlug: string }) {
  return (
    <Link
      href={gearSuggestionHref(guide.slug)}
      className="group flex items-center gap-3 rounded-lg border border-accent/20 bg-white px-3.5 py-3 shadow-sm transition-colors hover:border-accent/50 hover:bg-accent/[0.04]"
      onClick={() => trackGearSuggestionClick({ guideSlug: guide.slug, shelterSlug, reason: guide.reason })}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-primary">
          {guide.reason.charAt(0).toUpperCase() + guide.reason.slice(1)}
        </span>
        <span className="block text-xs font-semibold text-accent-dark group-hover:underline">
          {guide.title}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-accent-dark/70 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
