// web/app/(site)/aktiver-booking/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BookingActivationForm } from "@/components/BookingActivationForm";

export const metadata: Metadata = {
  title: "Aktiver bookingsystem | ShelterDK",
  description:
    "Tilmeld dit shelter til ShelterDKs bookingsystem. Gratis for shelter-ejere — gæsterne booker online, du slipper for dobbeltbookinger og administration.",
  robots: "noindex",
};

const BENEFITS = [
  {
    icon: "🚫",
    title: "Ingen dobbeltbookinger",
    text: "Kalenderen opdateres i realtid. To gæster kan aldrig booke samme dato.",
  },
  {
    icon: "📊",
    title: "Fuldt overblik",
    text: "Alle kommende bookinger ét sted. Hvem, hvornår og kontaktinfo — altid tilgængeligt.",
  },
  {
    icon: "⚡",
    title: "Nul administration",
    text: "Gæsten booker selv. Du får en notifikation og behøver ikke foretage dig noget.",
  },
  {
    icon: "📬",
    title: "Automatiske bekræftelser",
    text: "Gæsten får straks en bekræftelses-email. Du slipper for at svare på henvendelser.",
  },
  {
    icon: "🗺️",
    title: "Mere synlighed",
    text: "Bookbare shelters fremhæves i søgeresultaterne på Danmarks største shelter-site.",
  },
  {
    icon: "💸",
    title: "Gratis for dig som ejer",
    text: "Ingen oprettelsespris, ingen abonnement. Du betaler ingenting.",
  },
];

const FLOW_STEPS = [
  {
    icon: "🧭",
    title: "Gæsten finder dit shelter",
    sub: "47.000 månedlige besøgende på ShelterDK",
    highlight: false,
  },
  {
    icon: "📅",
    title: "Gæsten vælger dato og booker",
    sub: "Kalender opdateres automatisk",
    highlight: false,
  },
  {
    icon: "📩",
    title: "Du modtager en bekræftelse",
    sub: "Navn, dato og kontaktinfo på gæsten",
    highlight: false,
  },
  {
    icon: "🏕️",
    title: "Gæsten ankommer — ingen overraskelser",
    sub: "Ingen dobbeltbookinger. Nogensinde.",
    highlight: true,
  },
];

export default function AktiverBookingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 border-b border-accent/20 px-4 py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-accent/30 text-accent text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              ✦ Gratis for shelter-ejere
            </div>
            <h1 className="text-4xl font-bold leading-tight text-primary mb-4">
              Lad gæsterne booke
              <br />
              <span className="text-accent italic font-serif">
                dit shelter online
              </span>
            </h1>
            <p className="text-primary/60 text-lg mb-8 leading-relaxed">
              Slip for dobbeltbookinger og administration. Bookingsystemet
              håndterer alt automatisk — og det koster dig ingenting.
            </p>
            <a
              href="#tilmeld"
              className="inline-block bg-accent text-white font-bold px-6 py-3.5 rounded-xl hover:opacity-90 transition shadow-md"
            >
              Tilmeld dit shelter →
            </a>
          </div>

          {/* Flow diagram */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-primary/8">
              <p className="text-xs text-primary/40 uppercase tracking-wider font-semibold mb-4">
                Sådan virker det
              </p>
              <div className="space-y-3">
                {FLOW_STEPS.map((step, i) => (
                  <div key={i}>
                    <div
                      className={`flex items-center gap-4 rounded-xl p-4 ${
                        step.highlight
                          ? "bg-accent/10 border border-accent/20"
                          : "bg-background"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
                        {step.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {step.title}
                        </p>
                        <p
                          className={`text-xs ${
                            step.highlight
                              ? "text-accent font-medium"
                              : "text-primary/40"
                          }`}
                        >
                          {step.sub}
                        </p>
                      </div>
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <div className="flex justify-center text-accent font-bold py-0.5">
                        ↓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -top-3 -right-3 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-full shadow rotate-2">
              Helt gratis ✓
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-16 bg-white border-b border-primary/8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-primary mb-12">
            Hvad får du ud af det?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-xl flex-shrink-0">
                  {b.icon}
                </div>
                <div>
                  <h3 className="font-bold text-primary mb-1">{b.title}</h3>
                  <p className="text-primary/60 text-sm leading-relaxed">
                    {b.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 bg-background border-b border-primary/8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-primary mb-2">
            Kom i gang på 5 minutter
          </h2>
          <p className="text-center text-primary/50 text-sm mb-10">
            Vi klarer resten. Du er klar til at modtage bookinger allerede i
            dag.
          </p>
          <div className="space-y-5">
            {[
              {
                n: 1,
                title: "Udfyld formularen herunder",
                sub: "Angiv navn, organisation og email. Under 2 minutter.",
              },
              {
                n: 2,
                title: "Vi godkender og opsætter dit shelter",
                sub: "Vi kontakter dig inden for 1–2 hverdage og aktiverer bookingkalenderen.",
              },
              {
                n: 3,
                title: "Gæsterne begynder at booke",
                sub: "Du modtager en email for hver booking — kalenderen holder styr på resten.",
              },
            ].map((s) => (
              <div key={s.n} className="flex gap-5 items-start">
                <div className="flex-shrink-0 w-9 h-9 bg-accent text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {s.n}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-primary mb-0.5">{s.title}</h3>
                  <p className="text-primary/50 text-sm">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="tilmeld" className="px-4 py-16 bg-white">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-primary mb-2">
              Tilmeld dit shelter
            </h2>
            <p className="text-primary/50 text-sm">
              Gratis. Ingen binding. Opsig med 1 måneds varsel.
            </p>
          </div>
          <BookingActivationForm />
        </div>
      </section>

      {/* Footer nav */}
      <footer className="border-t border-primary/8 px-4 py-6 bg-background">
        <nav className="max-w-5xl mx-auto text-xs text-primary/40 flex gap-2">
          <Link href="/" className="hover:text-accent transition-colors">
            Hjem
          </Link>
          <span>/</span>
          <span>Aktiver bookingsystem</span>
        </nav>
      </footer>
    </div>
  );
}
