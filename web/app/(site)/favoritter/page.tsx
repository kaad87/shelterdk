import type { Metadata } from "next";
import { FavoritterClient } from "./FavoritterClient";

export const metadata: Metadata = {
  title: { absolute: "Mine favoritter | ShelterDK" },
  description: "Dine gemte shelters — find tilbage til de pladser du vil overveje.",
  alternates: { canonical: "https://shelterdk.dk/favoritter" },
  robots: { index: false, follow: true },
};

export default function FavoritterPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <header className="mb-8">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1.5">
            Mine favoritter
          </p>
          <h1 className="font-serif text-3xl font-bold text-primary leading-tight">
            Dine gemte shelters
          </h1>
          <p className="mt-2 text-primary/60 text-sm leading-relaxed">
            Favoritter gemmes lokalt i din browser — du behøver ikke en konto.
            Slet cookies/data, og listen forsvinder.
          </p>
        </header>

        <FavoritterClient />
      </div>
    </div>
  );
}
