// components/TripPostCard.tsx
"use client";

import { Calendar, Users, MapPin } from "lucide-react";
import type { TripPost } from "@/lib/turvenner";

interface Props {
  post: TripPost;
  onContact: (post: TripPost) => void;
  onReport: (post: TripPost) => void;
}

export function TripPostCard({ post, onContact, onReport }: Props) {
  const tripDateStr = post.trip_date
    ? new Date(post.trip_date).toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const createdStr = new Date(post.created_at).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="rounded-xl border border-primary/10 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-serif text-lg font-semibold text-primary leading-tight">
          {post.title}
        </h3>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          <Users size={13} />
          {post.spots_available} {post.spots_available === 1 ? "plads" : "pladser"}
        </span>
      </div>

      <p className="text-sm text-primary/70 mb-3 line-clamp-3">
        {post.description}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary/50 mb-4">
        <span className="inline-flex items-center gap-1">
          <MapPin size={13} />
          {post.region}
        </span>
        {tripDateStr && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={13} />
            {tripDateStr}
          </span>
        )}
        <span>Af {post.author_name} · {createdStr}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onContact(post)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-dark px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 transition-colors"
        >
          Kontakt
        </button>
        <button
          onClick={() => onReport(post)}
          className="text-xs text-primary/30 hover:text-red-500 transition-colors ml-auto"
        >
          Rapportér
        </button>
      </div>
    </div>
  );
}
