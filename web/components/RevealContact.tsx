"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

/**
 * Ejer-kontakt bag et klik: holder mail/telefon ude af den statiske HTML
 * (høst-bots scraper renderet markup) og signalerer samtidig at oplysningerne
 * er til seriøse henvendelser. Indholdet er allerede i RSC-payloaden — det
 * her er spam-reduktion, ikke kryptering.
 */
export function RevealContact({ contact }: { contact: string }) {
  const [shown, setShown] = useState(false);

  if (shown) {
    return (
      <span className="break-all">
        <strong className="text-primary">Kontakt:</strong> {contact}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
    >
      <Mail size={14} className="text-accent" />
      Vis kontaktoplysninger
    </button>
  );
}
