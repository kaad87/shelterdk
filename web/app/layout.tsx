import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://shelterdk.dk"),
  title: {
    default: "ShelterDK – Find shelters i Danmark",
    template: "%s | ShelterDK",
  },
  description:
    "Find og udforsk shelters i hele Danmark. Se billeder, anmeldelser og praktisk info for overnatning i naturen.",
  openGraph: {
    siteName: "ShelterDK",
    type: "website",
    locale: "da_DK",
    images: [
      {
        url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "Shelter i dansk natur",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/svg+xml" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className={`${dmSans.variable} ${playfair.variable}`}>
      <head>
        {/* S1: Preconnect & dns-prefetch for critical external origins */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://maps.geoapify.com" />
        {process.env.NEXT_PUBLIC_ADSENSE_PUB_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_PUB_ID}`}
            crossOrigin="anonymous"
            strategy="lazyOnload"
          />
        )}
      </head>
      <body className="min-h-screen flex flex-col font-sans antialiased bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
        >
          Spring til indhold
        </a>
        {children}
      </body>
    </html>
  );
}
