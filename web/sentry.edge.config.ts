// Sentry config for Edge-runtime (middleware + edge route handlers).
//
// Edge runtime har et mindre subset af Node APIs, så vi holder configen
// minimal. Aktiveres kun når DSN er sat.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
  });
}
