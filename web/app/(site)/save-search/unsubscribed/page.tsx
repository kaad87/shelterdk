import Link from "next/link";
import type { Metadata } from "next";
import { Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Afmeldt — ShelterDK",
  robots: { index: false, follow: false },
};

export default function SavedSearchUnsubscribedPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/5 text-primary/55 mb-5">
        <Mail size={28} />
      </div>
      <h1 className="font-serif text-2xl font-bold text-primary mb-3">
        Du er nu afmeldt
      </h1>
      <p className="text-primary/70 text-sm leading-relaxed mb-6">
        Vi sender dig ikke flere e-mails om denne søgning. Tak fordi du var med — du kan altid gemme en ny søgning igen.
      </p>
      <Link
        href="/soeg"
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition-colors"
      >
        Tilbage til søgning
      </Link>
    </main>
  );
}
