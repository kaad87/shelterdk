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

// Google AdSense (Auto Ads) + Funding Choices CMP kræver en del domæner.
// Uden disse blokerer CSP'en adsbygoogle.js → ingen annoncer OG intet
// CMP-samtykkebanner (CMP'en loades af AdSense-scriptet).
const googleAdsScriptSrc =
  "https://pagead2.googlesyndication.com https://*.googlesyndication.com https://partner.googleadservices.com https://*.googleadservices.com https://www.googletagservices.com https://adservice.google.com https://*.google.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google https://cdn.ampproject.org";
const googleAdsFrameSrc =
  "https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.safeframe.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google https://cdn.ampproject.org";
const googleAdsConnectSrc =
  "https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://fundingchoicesmessages.google.com https://*.adtrafficquality.google";
// CMP-banneret + ad-UI loader CSS + fonte fra Googles asset-hosts.
const googleAdsStyleSrc =
  "https://fonts.googleapis.com https://*.gstatic.com https://*.googlesyndication.com https://fundingchoicesmessages.google.com";
const googleAdsFontSrc =
  "https://fonts.gstatic.com https://*.gstatic.com https://*.googlesyndication.com";

const baseCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self'",
  // 'unsafe-eval' kræves af Googles annonce-kreativer (de evaluerer JS).
  // Trade-off: svækker XSS-beskyttelse en smule, men 'unsafe-inline' er
  // allerede til stede, og det er nødvendigt for at AdSense kan vise annoncer.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://tags.srv.stackadapt.com ${googleAdsScriptSrc}`,
  `style-src 'self' 'unsafe-inline' https://tags.srv.stackadapt.com ${googleAdsStyleSrc}`,
  "img-src 'self' data: blob: https:",
  `font-src 'self' data: ${googleAdsFontSrc}`,
  `connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://tags.srv.stackadapt.com https://*.stackadapt.com ${googleAdsConnectSrc}`,
  `frame-src 'self' https://checkout.stripe.com https://www.instagram.com ${googleAdsFrameSrc}`,
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
