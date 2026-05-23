"use client";

// React error-boundary for fejl der bubbler op til root-layoutet. Den
// almindelige (site)/error.tsx fanger fejl indenfor route-groupen — global-
// error.tsx er fallback for fejl udenfor (fx i selve root-layoutet).
//
// Sentry capturer fejlen automatisk + renderer en simpel reset-UI.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="da">
      <body className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center font-sans">
        <h1 className="font-serif text-2xl font-bold text-primary mb-3">
          Noget gik galt
        </h1>
        <p className="text-primary/70 mb-6 max-w-md">
          Vi har modtaget en fejlrapport og kigger på det. Prøv at indlæse siden
          igen — eller gå tilbage til forsiden.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent-dark text-white font-medium px-5 py-2.5 hover:bg-accent-dark/90 transition-colors"
          >
            Prøv igen
          </button>
          <a
            href="/"
            className="rounded-lg border border-primary/20 text-primary font-medium px-5 py-2.5 hover:bg-primary/5 transition-colors"
          >
            Til forsiden
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-primary/40 mt-8 font-mono">
            Fejl-ID: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
