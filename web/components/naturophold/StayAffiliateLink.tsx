"use client";

import { ExternalLink } from "lucide-react";
import { trackAffiliateClick } from "@/lib/tracking";
import type { StayLinkSource } from "@/lib/nature-stays";

const LABEL: Record<StayLinkSource, string> = {
  booking_com: "Se på Booking.com",
  direkte: "Se & book",
  andet_netvaerk: "Se & book",
};

/** Tracket affiliate-CTA for et naturophold. Disclosure vises separat på siden. */
export function StayAffiliateLink({
  name,
  url,
  linkSource,
  priceFrom,
  position,
  className,
}: {
  name: string;
  url: string | null;
  linkSource: StayLinkSource;
  priceFrom?: number | null;
  position: "naturophold_guide" | "naturophold_planb" | "naturophold_map";
  className?: string;
}) {
  if (!url) {
    return (
      <span className={`block rounded-lg bg-primary/5 px-3 py-1.5 text-center text-xs font-medium text-primary/50 ${className ?? ""}`}>
        Link mangler
      </span>
    );
  }
  const label = LABEL[linkSource];
  return (
    <a
      href={url}
      target="_blank"
      rel="sponsored nofollow noopener"
      aria-label={`${label} — ${name}`}
      onClick={() =>
        trackAffiliateClick({
          url,
          productName: name,
          retailer: linkSource,
          position,
          priceDkk: typeof priceFrom === "number" ? priceFrom : undefined,
        })
      }
      className={`inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 ${className ?? ""}`}
    >
      {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
