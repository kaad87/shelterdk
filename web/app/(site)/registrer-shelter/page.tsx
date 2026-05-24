import type { Metadata } from "next";
import { RegistrerShelterForm } from "./RegistrerShelterForm";

export const metadata: Metadata = {
  // Plain-string title så root layout's template appender " | ShelterDK".
  // Vi droppede "på ShelterDK" fra selve titlen for at undgå awkward
  // "Registrér dit shelter på ShelterDK | ShelterDK"-rendering.
  title: "Registrér dit shelter",
  description:
    "Er du ejer eller operatør af et shelter? Tilmeld det gratis og nå tusindvis af friluftsentusiaster på Danmarks største shelterguide.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://shelterdk.dk/registrer-shelter" },
};

export default function RegistrerShelterPage() {
  return (
    <div className="min-h-screen bg-[#f9f7f4]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a3a26] to-[#2d7a4e] text-white py-14 px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3">
            Få dit shelter på Danmarks største shelterguide
          </h1>
          <p className="text-white/80 text-lg">
            Gratis · du godkender inden publicering · når tusindvis af friluftsentusiaster
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">🆓</span>
              <span>
                <strong>Helt gratis</strong>
                <br />
                <span className="text-white/70">Altid</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span>
                <strong>Du godkender</strong>
                <br />
                <span className="text-white/70">Inden publicering</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <span>
                <strong>Opdatér når du vil</strong>
                <br />
                <span className="text-white/70">Kontakt os ved ændringer</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <RegistrerShelterForm />
      </div>
    </div>
  );
}
