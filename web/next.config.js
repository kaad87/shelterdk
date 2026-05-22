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

const baseCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://*.supabase.co",
  "frame-src 'self' https://checkout.stripe.com https://www.instagram.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const embedCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors *",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.instagram.com https://*.supabase.co",
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

module.exports = nextConfig;
