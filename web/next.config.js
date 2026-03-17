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

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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

