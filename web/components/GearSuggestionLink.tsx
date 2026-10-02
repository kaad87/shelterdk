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
 */
export function GearSuggestionLink({ guide, shelterSlug }: { guide: GuideLink; shelterSlug: string }) {
  return (
    <Link
      href={gearSuggestionHref(guide.slug)}
      className="group flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2.5 transition-colors hover:bg-white"
      onClick={() => trackGearSuggestionClick({ guideSlug: guide.slug, shelterSlug, reason: guide.reason })}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-primary group-hover:text-accent transition-colors">
          {guide.title}
        </span>
        <span className="block text-xs text-primary/55">— {guide.reason}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-accent/60 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
