import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

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
        <h1 className="font-serif text-4xl font-bold text-primary mb-8">
          Kontakt
        </h1>

        <p className="text-primary/90 text-lg leading-relaxed mb-10">
          Har du spørgsmål, forslag eller fundet en fejl? Vi hører gerne fra dig.
        </p>

        <div className="space-y-6">
          <div className="flex gap-4 rounded-xl border border-primary/10 bg-white p-6">
            <div className="rounded-full bg-accent/20 p-3 h-fit shrink-0">
              <Mail className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-primary mb-1">
                E-mail
              </h2>
              <p className="text-primary/80 text-sm mb-2">
                Skriv til os for generelle henvendelser, fejlrapporter eller
                forslag til forbedringer.
              </p>
              <a
                href="mailto:kontakt@shelterdk.dk"
                className="text-accent font-medium hover:underline"
              >
                kontakt@shelterdk.dk
              </a>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-primary/10 bg-white p-6">
            <div className="rounded-full bg-accent/20 p-3 h-fit shrink-0">
              <MessageSquare className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-primary mb-1">
                Fejl i data
              </h2>
              <p className="text-primary/80 text-sm">
                Shelterdata kommer fra GeoFA, Naturstyrelsen og andre kilder. Hvis
                du finder fejl (fx forkert placering eller manglende info), kan
                du rapportere det – vi videresender gerne til de rette myndigheder
                eller retter, hvad vi selv kan.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-10 text-primary/60 text-sm">
          Vi er et lille hobbyprojekt, så det kan tage et par dage at svare.
          Tak for din besked.
        </p>
      </div>
    </div>
    </>
  );
}
