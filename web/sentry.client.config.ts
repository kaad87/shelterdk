// Sentry config for browser-runtime errors.
//
// Aktiveres KUN når NEXT_PUBLIC_SENTRY_DSN er sat — så lokal dev og test
// kan køre uden Sentry-quota-forbrug. Sample rates er satset konservativt
// for en lille site så vi ikke rammer free-tier'en (5k events/måned).
//
// Tilpas i Sentry dashboard hvis I oplever for meget støj.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // Error sampling: 100% af errors logges (de er sjældne nok).
    sampleRate: 1.0,

    // Trace sampling: 10% af transactions for performance-monitoring.
    // Free tier = 10k traces/måned, så 10% giver plads til ~100k page-loads.
    tracesSampleRate: 0.1,

    // Replay (record session video on error): slå fra som default —
    // det er nyttigt men quota-tungt. Aktivér i Sentry dashboard hvis I vil.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filtrer almindelig browser-støj fra (extensions, tracking-blockers,
    // ResizeObserver-loops, network errors fra annonceblokkere etc.).
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
      // ResizeObserver-loop er sikker at ignorere
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network errors fra ad-blockers / privacy-extensions
      "Failed to fetch",
      "NetworkError when attempting to fetch resource",
      "Load failed",
      // Tracking-blockers
      /googletagmanager/i,
      /google-analytics/i,
      // Annulleret af brugeren (ikke en bug)
      "AbortError: The user aborted a request",
    ],

    // Send-hooks: sidste filter før event går til Sentry.
    beforeSend(event) {
      // Drop events fra crawlere / bots
      const ua = event.request?.headers?.["user-agent"];
      if (ua && /bot|crawl|spider|google|bing/i.test(ua)) return null;
      return event;
    },
  });
}
