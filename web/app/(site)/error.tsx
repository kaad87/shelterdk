"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ShelterDK fejl:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <p className="text-accent font-medium text-sm mb-3">Fejl</p>
      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary mb-2 text-center">
        Noget gik galt
      </h1>
      <p className="text-primary/70 text-center mb-8 max-w-md">
        Der opstod en uventet fejl. Prøv at genindlæse siden eller gå til forsiden.
      </p>
      <div className="flex flex-wrap gap-4 justify-center mb-12">
        <button
          onClick={reset}
          className="rounded-lg bg-accent-dark text-white font-medium px-6 py-3 hover:bg-accent-dark/90 transition-colors"
        >
          Prøv igen
        </button>
        <Link
          href="/"
          className="rounded-lg border border-primary/20 text-primary font-medium px-6 py-3 hover:bg-primary/5 transition-colors"
        >
          Gå til forsiden
        </Link>
      </div>
      <div className="max-w-sm w-full">
        <p className="text-primary/60 text-sm font-medium mb-3 text-center">Populære sider</p>
        <ul className="space-y-2 text-sm text-center">
          <li>
            <Link href="/soeg" className="text-accent hover:underline">
              Søg shelters
            </Link>
          </li>
          <li>
            <Link href="/shelter-naer-mig" className="text-accent hover:underline">
              Find shelter nær mig
            </Link>
          </li>
          <li>
            <Link href="/faq" className="text-accent hover:underline">
              Ofte stillede spørgsmål
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
