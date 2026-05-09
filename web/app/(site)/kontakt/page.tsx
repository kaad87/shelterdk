import type { Metadata } from "next";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: { absolute: "Kontakt | ShelterDK" },
  description:
    "Kontakt ShelterDK – spørgsmål, forslag eller fejlrapporter om shelters i Danmark.",
  alternates: { canonical: "https://shelterdk.dk/kontakt" },
  openGraph: {
    title: "Kontakt | ShelterDK",
    description: "Kontakt ShelterDK – spørgsmål, forslag eller fejlrapporter om shelters i Danmark.",
    url: "/kontakt",
  },
};

export default function KontaktPage() {
  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Kontakt" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <h1 className="font-serif text-4xl font-bold text-primary mb-4">
          Kontakt
        </h1>

        <p className="text-primary/90 text-lg leading-relaxed mb-10">
          Har du spørgsmål, forslag eller fundet en fejl? Skriv til os via formularen
          nedenfor, så vender vi tilbage hurtigst muligt.
        </p>

        <ContactForm />

        <p className="mt-10 text-primary/60 text-sm">
          Vi er et lille team, så det kan tage et par dage at svare.
          Tak for din besked.
        </p>
      </div>
    </div>
    </>
  );
}
