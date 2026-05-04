"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackOutboundClick } from "@/lib/tracking";

interface TrackedExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  eventLabel: string;
  children: ReactNode;
}

export function TrackedExternalLink({
  href,
  eventLabel,
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
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
