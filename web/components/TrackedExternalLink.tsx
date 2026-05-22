"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackBookButtonClick, trackOutboundClick } from "@/lib/tracking";

interface BookContext {
  shelterId: string;
  shelterSlug: string;
  bookingType: "external" | "naturstyrelsen_fallback";
  position: "main_card" | "sticky_mobile";
}

interface TrackedExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  eventLabel: string;
  /** When set, also fires the book_button_clicked GA4 event for funnel tracking. */
  bookContext?: BookContext;
  children: ReactNode;
}

export function TrackedExternalLink({
  href,
  eventLabel,
  bookContext,
  children,
  onClick,
  rel,
  target = "_blank",
  ...rest
}: TrackedExternalLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel ?? "noopener noreferrer"}
      onClick={(event) => {
        trackOutboundClick(href, eventLabel);
        if (bookContext) trackBookButtonClick(bookContext);
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
