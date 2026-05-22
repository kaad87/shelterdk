"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackBookButtonClick } from "@/lib/tracking";

interface TrackedBookLinkProps {
  href: string;
  shelterId: string;
  shelterSlug: string;
  bookingType: "shelterdk" | "multi_unit";
  position: "main_card" | "sticky_mobile";
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * Internal Book CTA link that fires the book_button_clicked GA4 event
 * before navigating. Used on shelter detail pages.
 */
export function TrackedBookLink({
  href,
  shelterId,
  shelterSlug,
  bookingType,
  position,
  className,
  ariaLabel,
  children,
}: TrackedBookLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        trackBookButtonClick({ shelterId, shelterSlug, bookingType, position });
      }}
    >
      {children}
    </Link>
  );
}
