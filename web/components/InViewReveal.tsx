"use client";

import type { ReactNode } from "react";
import { useInView } from "@/lib/useInView";

interface InViewRevealProps {
  children: ReactNode;
  index?: number;
}

export function InViewReveal({ children, index = 0 }: InViewRevealProps) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={isInView ? "animate-fade-in-up" : undefined}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {children}
    </div>
  );
}
