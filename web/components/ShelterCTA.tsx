import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

interface ShelterCTAProps {
  variant?: "inline" | "full";
}

export function ShelterCTA({ variant = "inline" }: ShelterCTAProps) {
  if (variant === "full") {
    return (
      <section className="mt-12">
        <div className="rounded-xl bg-primary text-white p-8 sm:p-10 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">
            Find det perfekte shelter
          </h2>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Søg blandt 800+ shelters i hele Danmark. Filtrer på faciliteter,
            booking og område.
          </p>
          <Link
            href="/soeg"
            className="inline-flex items-center gap-2 bg-accent-dark text-white px-6 py-3 rounded-full font-medium hover:bg-accent-dark/90 transition-colors"
          >
            Søg shelters
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="my-10 rounded-xl bg-accent/10 border border-accent/20 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <MapPin size={20} className="text-accent" />
        </div>
        <div>
          <p className="font-serif text-lg font-bold text-primary">
            Find det perfekte shelter til din tur
          </p>
          <p className="text-primary/70 text-sm mt-1 mb-4">
            Søg blandt 800+ shelters i hele Danmark — filtrer på faciliteter,
            booking og område.
          </p>
          <Link
            href="/soeg"
            className="inline-flex items-center gap-2 bg-accent-dark text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-accent-dark/90 transition-colors"
          >
            Søg shelters
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
