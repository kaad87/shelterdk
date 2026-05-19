"use client";

import Link from "next/link";
import { MapPin, CheckCircle, Flame, Gift, Bath } from "lucide-react";
import { HomepageDatePicker } from "@/components/HomepageDatePicker";

const PILLS = [
  { label: "Nær mig", href: "/shelter-naer-mig", icon: MapPin, accent: true },
  { label: "Book shelter", href: "/shelter-booking", icon: CheckCircle, accent: false },
  { label: "Med bål", href: "/shelter-med-baalplads", icon: Flame, accent: false },
  { label: "Gratis", href: "/soeg?gratis=1", icon: Gift, accent: false },
  { label: "Med toilet", href: "/shelter-med-toilet", icon: Bath, accent: false },
] as const;

export function MobileHomePills() {
  return (
    <section className="md:hidden py-3 bg-background" aria-label="Hurtige filtre">
      <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
        {PILLS.map((pill) => (
          <Link
            key={pill.href}
            href={pill.href}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium shrink-0 ${
              pill.accent
                ? "bg-green-50 border border-green-200 text-green-700"
                : "border border-primary/15 bg-white text-primary/70"
            }`}
          >
            <pill.icon size={15} />
            {pill.label}
          </Link>
        ))}
        <HomepageDatePicker className="shrink-0" />
      </div>
    </section>
  );
}
