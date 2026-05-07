import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Ejer-portal | ShelterDK" },
  robots: { index: false, follow: false },
};

export default function EjerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="border-b border-primary/10 bg-white px-5 py-4 flex items-center justify-between">
        <a href="/" className="font-serif font-bold text-lg text-primary tracking-tight">
          ShelterDK
        </a>
        <span className="text-xs text-primary/40 uppercase tracking-widest font-semibold">Ejer-portal</span>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {children}
      </main>
    </div>
  );
}
