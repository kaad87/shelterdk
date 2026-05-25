"use client";

import {
  Accessibility,
  Armchair,
  CalendarCheck,
  Dog,
  Droplets,
  Flame,
  ShowerHead,
  Star,
  Umbrella,
} from "lucide-react";
import type { SoegFilters } from "@/lib/soeg-db";

/** Inline toilet/WC icon — lucide v0.294 har ingen Toilet-ikon. */
export function ToiletIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 3h14v6a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V3z" />
      <path d="M9 14v2l-2 5h10l-2-5v-2" />
    </svg>
  );
}

export type FilterGroup = "primaer" | "faciliteter" | "kvalitet";

export type FilterOption = {
  key: keyof SoegFilters;
  label: string;
  icon: React.ReactNode;
  group: FilterGroup;
};

export const FILTER_OPTIONS: FilterOption[] = [
  // Primær (afgørende beslutninger — vist altid på mobil)
  { key: "bookbar", label: "Bookbar", icon: <CalendarCheck size={15} />, group: "primaer" },
  // Faciliteter
  { key: "toilet", label: "Toilet", icon: <ToiletIcon size={15} />, group: "faciliteter" },
  { key: "vand", label: "Vand", icon: <Droplets size={15} />, group: "faciliteter" },
  { key: "baalplads", label: "Bålplads", icon: <Flame size={15} />, group: "faciliteter" },
  { key: "hund", label: "Hund tilladt", icon: <Dog size={15} />, group: "faciliteter" },
  { key: "strand", label: "Strand", icon: <Umbrella size={15} />, group: "faciliteter" },
  { key: "bruser", label: "Bruser/bad", icon: <ShowerHead size={15} />, group: "faciliteter" },
  { key: "handicap", label: "Handicapegnet", icon: <Accessibility size={15} />, group: "faciliteter" },
  { key: "bord_baenk", label: "Bord/bænke", icon: <Armchair size={15} />, group: "faciliteter" },
  // Kvalitet
  { key: "anmeldelser", label: "Anmeldelser", icon: <Star size={15} />, group: "kvalitet" },
];

export const PRIMARY_FILTER_KEYS = new Set<keyof SoegFilters>(
  FILTER_OPTIONS.filter((f) => f.group === "primaer").map((f) => f.key)
);
