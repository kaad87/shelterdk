/** @type {import('next').NextConfig} */
// Supabase API + Storage bruger samme host (fx xxx.supabase.co) – tillader next/image for begge
const supabaseHost =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
    ? (() => {
        try {
          return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
        } catch {
          return null;
        }
      })()
    : null;

// AdSense kræver disse domæner i CSP'en (ellers blokeres ad-scriptet/iframes).
const adsense = {
  script: "https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.googleadservices.com https://*.g.doubleclick.net https://adservice.google.com",
  connect: "https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.g.doubleclick.net https://*.google.com",
  frame: "https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.safeframe.googlesyndication.com https://*.googlesyndication.com",
};

const baseCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://tags.srv.stackadapt.com ${adsense.script}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://tags.srv.stackadapt.com https://*.stackadapt.com ${adsense.connect}`,
  `frame-src 'self' https://checkout.stripe.com https://www.instagram.com ${adsense.frame}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const embedCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors *",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://tags.srv.stackadapt.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://tags.srv.stackadapt.com https://*.stackadapt.com",
  "frame-src 'self' https://checkout.stripe.com https://www.instagram.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig = {
  // Sitemap.ts genererer 2.900+ URL'er + DB-kald ved build; default 60s-timeout
  // kan rammes på CI (flaky → fejlet deploy). Giv tunge static-genereringer mere tid.
  staticPageGenerationTimeout: 180,
  experimental: {
    // Tree-shake lucide-react and other icon libs: ship only the icons imported.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/embed/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            value: embedCsp,
          },
        ],
      },
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: baseCsp },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          { key: "Origin-Agent-Cluster", value: "?1" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/icons/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Konsolidering af kannibaliserende blogposts → de tilsvarende guides
      // (indholdet er flyttet med over; autoriteten skal samles ét sted).
      { source: "/blog/shelter-regler-overnatning", destination: "/guides/regler-for-shelter-og-teltning-i-danmark", permanent: true },
      { source: "/blog/hvordan-v%C3%A6lge-shelter", destination: "/guides/saadan-finder-du-det-perfekte-shelter", permanent: true },
      // Tom guide-kategori fjernet (ingen guides i Udstyr — købsguider bor i /bedste)
      { source: "/guides/kategori/udstyr", destination: "/guides", permanent: true },
      { source: "/danmark/jylland/ny-hammersholt", destination: "/danmark/jylland", permanent: true },
      { source: "/danmark/jylland/fons", destination: "/danmark/jylland", permanent: true },
      { source: "/danmark/fyn/dybbol", destination: "/danmark/fyn", permanent: true },
      // /opret-shelter er en ældre intern formular der ikke længere linkes
      // til fra navigation. /registrer-shelter er den nuværende offentlige
      // landing page. Konsoliderer eksterne links og bookmarks.
      { source: "/opret-shelter", destination: "/registrer-shelter", permanent: true },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dynamic-media-cdn.tripadvisor.com",
      },
      {
        protocol: "https",
        hostname: "cdn.campanyon.com",
      },
      {
        protocol: "https",
        hostname: "media.glampinghub.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
      {
        protocol: "https",
        hostname: "mapcentia-www.s3-eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "geofa.geodanmark.dk",
      },
      {
        protocol: "https",
        hostname: "udinaturen.dk",
      },
      {
        protocol: "https",
        hostname: "book.naturstyrelsen.dk",
      },
      {
        protocol: "https",
        hostname: "kortservice2.vejle.dk",
      },
      {
        protocol: "http",
        hostname: "apps.aalborgkommune.dk",
      },
      {
        protocol: "https",
        hostname: "apps.aalborgkommune.dk",
      },
      {
        protocol: "http",
        hostname: "webkort.esbjergkommune.dk",
      },
      {
        protocol: "https",
        hostname: "webkort.esbjergkommune.dk",
      },
      {
        protocol: "https",
        hostname: "webkort.herning.dk",
      },
      // Supabase Storage (brugeruploadede billeder) – samme host som API
      ...(supabaseHost ? [{ protocol: "https", hostname: supabaseHost }] : []),
    ],
  },
};

// Sentry-integration: withSentryConfig wrapperen er ALTID nødvendig fordi
// den injicerer sentry.{client,server,edge}.config.ts ind i build-output'et.
// Wrapper-no-op'er gracefully hvis NEXT_PUBLIC_SENTRY_DSN ikke er sat (vores
// config-filer guard'er selv på DSN-tilstedeværelse).
//
// Source-map upload til Sentry kører kun når SENTRY_AUTH_TOKEN er sat
// (typisk i CI/Netlify build env). Uden token bygges sitet stadig fint,
// kun bedre stack-traces mangler så.
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  // Source-map upload-opts. Token-mangel = upload skippes automatisk.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Skjul source-map filer fra production bundle så de ikke serveres
  // direkte fra /_next/static/ — kun Sentry får dem.
  hideSourceMaps: true,

  // Wider source-map upload (langsommere build, men bedre stack-traces).
  widenClientFileUpload: true,

  // Disable Sentry's egen telemetri til Sentry.
  telemetry: false,

  // Silent: undgå spam i build-loggen lokalt (CI viser stadig output).
  silent: !process.env.CI,
});
