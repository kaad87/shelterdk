import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface AuthorBioProps {
  linkTo?: string;
  linkLabel?: string;
}

export function AuthorBio({
  linkTo = "/blog",
  linkLabel = "Se alle artikler",
}: AuthorBioProps) {
  return (
    <div className="rounded-xl border border-primary/10 bg-white p-6 flex gap-5 items-start">
      <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
        <span className="text-accent font-serif font-bold text-lg">CK</span>
      </div>
      <div>
        <p className="font-serif font-bold text-primary text-lg">
          Skrevet af Christian
        </p>
        <p className="text-primary/70 text-sm mt-1 leading-relaxed">
          Grundlægger af ShelterDK. Elsker shelterture, vandring og overnatning
          under åben himmel i den danske natur.
        </p>
        <Link
          href={linkTo}
          className="inline-flex items-center gap-1 text-accent text-sm font-medium hover:underline mt-3"
        >
          {linkLabel}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
