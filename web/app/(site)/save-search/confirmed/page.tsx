import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Alert bekræftet — ShelterDK",
  robots: { index: false, follow: false },
};

export default function SavedSearchConfirmedPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/15 text-accent-dark mb-5">
        <CheckCircle2 size={32} />
      </div>
      <h1 className="font-serif text-2xl font-bold text-primary mb-3">
        Din alert er aktiveret
      </h1>
      <p className="text-primary/70 text-sm leading-relaxed mb-6">
        Vi sender dig en e-mail når nye shelters matcher dine kriterier — typisk én gang om dagen,
        kun hvis der er nyt. Du kan altid afmelde via linket nederst i hver mail.
      </p>
      <Link
        href="/soeg"
        className="inline-flex items-center gap-1.5 rounded-xl bg-accent-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark/90 transition-colors"
      >
        Tilbage til søgning
      </Link>
    </main>
  );
}
