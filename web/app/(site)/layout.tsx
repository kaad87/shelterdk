import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { ShelterTipModalProvider } from "@/components/ShelterTipModalProvider";
import { ShelterTipModal } from "@/components/ShelterTipModal";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShelterTipModalProvider>
      <CookieBanner />
      <Suspense fallback={<header className="h-16 border-b border-primary/10" />}>
        <Navbar />
      </Suspense>
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <ShelterTipModal />
    </ShelterTipModalProvider>
  );
}
