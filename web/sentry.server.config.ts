// Sentry config for Node.js-runtime errors (API routes + server components).
//
// Aktiveres kun når SENTRY_DSN er sat. Bruger samme DSN som klienten —
// Sentry router events til den korrekte platform via runtime-tag.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    sampleRate: 1.0,
    tracesSampleRate: 0.1,

    // Filtrer netværks-noise som ikke er reelle bugs.
    ignoreErrors: [
      "AbortError",
      "Connection terminated unexpectedly",
      // Supabase rate-limit (vores egen) — vi logger dem allerede selv
      /Rate limit exceeded/i,
    ],

    beforeSend(event, hint) {
      // Drop expected user errors (4xx-lignende) — vi vil kun se reelle bugs
      const error = hint?.originalException;
      if (
        error instanceof Error &&
        /^(Unauthorized|Forbidden|Not Found|Bad Request|Conflict)$/i.test(error.message)
      ) {
        return null;
      }
      return event;
    },
  });
}
