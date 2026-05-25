import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Linket virker ikke — ShelterDK",
  robots: { index: false, follow: false },
};

export default function SavedSearchErrorPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-700 mb-5">
        <AlertCircle size={28} />
      </div>
      <h1 className="font-serif text-2xl font-bold text-primary mb-3">Linket virker ikke</h1>
      <p className="text-primary/70 text-sm leading-relaxed mb-6">
        Linket er udløbet eller allerede brugt. Hvis du forsøgte at bekræfte en alert, kan du gemme søgningen igen.
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
