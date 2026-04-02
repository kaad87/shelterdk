import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CookieBanner />
      <Suspense fallback={<header className="h-16 border-b border-primary/10" />}>
        <Navbar />
      </Suspense>
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
