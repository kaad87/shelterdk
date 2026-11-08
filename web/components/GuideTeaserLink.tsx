"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { trackGuideTeaserClick } from "@/lib/tracking";
import { guideHref } from "@/lib/guide-links";
import type { GuideKilde, GuideLink } from "@/lib/guide-links";

/**
 * Ét link i en guide-blok. Klientkomponent udelukkende for at kunne maale
 * klikket; App Router server-renderer den alligevel til HTML, saa linket er
 * crawlbart paa praecis samme vilkaar som et link i en serverkomponent.
 *
 * Begrundelsen baerer raekken og guidens titel staar under. Omvendt
 * raekkefoelge gav en liste af produktkategorier, der lignede en annonce —
 * samme erfaring som grej-blokken paa shelter-siderne.
 */
export function GuideTeaserLink({
  guide,
  kilde,
  variant = "liste",
}: {
  guide: GuideLink;
  kilde: GuideKilde;
  variant?: "liste" | "kort";
}) {
  const spor = () =>
    trackGuideTeaserClick({ guideSlug: guide.slug, kilde, reason: guide.reason });

  if (variant === "kort") {
    return (
      <Link
        href={guideHref(guide.slug, kilde)}
        onClick={spor}
        className="group flex h-full flex-col rounded-xl border border-primary/10 bg-white p-5 transition-all hover:border-accent/30 hover:shadow-md"
      >
        <h3 className="font-serif text-lg font-bold text-primary transition-colors group-hover:text-accent">
          {guide.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-primary/70">{guide.reason}</p>
        <span className="mt-auto pt-3 text-sm font-semibold text-accent-dark group-hover:underline">
          Se guiden
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={guideHref(guide.slug, kilde)}
      onClick={spor}
      className="group flex items-center gap-3 rounded-lg border border-accent/20 bg-white px-3.5 py-3 shadow-sm transition-colors hover:border-accent/50 hover:bg-accent/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-primary">{guide.reason}</span>
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
