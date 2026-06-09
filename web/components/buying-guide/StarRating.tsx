import { Star, StarHalf } from "lucide-react";
import { scoreToStars } from "@/lib/buying-guides-score";

/** 0-5 stjerner (halve understøttet) afledt af en 0-10 score. */
export function StarRating({ score, size = 14 }: { score: number; size?: number }) {
  const stars = scoreToStars(score);
  return (
    <span className="inline-flex items-center" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i + 1 <= Math.floor(stars);
        const half = !filled && i < stars && stars < i + 1;
        if (filled) return <Star key={i} size={size} className="fill-accent text-accent" />;
        if (half) return <StarHalf key={i} size={size} className="fill-accent text-accent" />;
        return <Star key={i} size={size} className="text-primary/20" />;
      })}
    </span>
  );
}
