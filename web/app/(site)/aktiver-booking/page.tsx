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

const PAIN_POINTS = [
  {
    icon: "📧",
    before: "»Er shelteret ledigt d. 14. juli?«",
    after:
      "Gæsten slår selv op, ser hvad der er ledigt og booker — uden at I behøver svare.",
  },
  {
    icon: "📋",
    before: "Et Excel-ark der ikke altid er opdateret",
    after:
      "Kalenderen opdateres automatisk. Ingen manuelle opdateringer, ingen forældede lister.",
  },
  {
    icon: "😬",
    before: "To grupper der mødes ved shelteret",
    after:
      "Umuligt med et digitalt system. To kan aldrig booke den samme dato.",
  },
];

const DETAILS = [
  {
    icon: "🆓",
    title: "Gratis for jer som ejere",
    text: "Ingen oprettelsespris, intet abonnement, ingen skjulte omkostninger. ShelterDK finansieres af et servicegebyr betalt af gæsten — I er ikke involveret i betalingen.",
  },
  {
    icon: "💬",
    title: "Vi håndterer al kommunikation",
    text: "Bookingbekræftelse, påmindelser og eventuelle aflysningsmails går direkte til gæsten. I får en notifikation med gæstens navn og kontaktinfo — det er alt.",
  },
  {
    icon: "🗓️",
    title: "Fuldt overblik, altid tilgængeligt",
    text: "Se hvem der kommer hvornår, og kontakt gæsten direkte ved behov. Ingen ring rundt, ingen mails frem og tilbage.",
  },
  {
    icon: "📍",
    title: "Gæster tør tage afsted",
    text: "Mange vælger et andet sted — eller bliver helt hjemme — fordi de er usikre på om shelteret er taget. En booking giver sikkerhed, og I får flere besøgende.",
  },
  {
    icon: "🔒",
    title: "Gebyret sikrer reelle bookinger",
    text: "Gæsten betaler 20 kr. til ShelterDK ved gennemført booking. Det er bevidst lavt, men nok til at folk ikke reserverer shelteret langt ind i fremtiden uden at have til hensigt at dukke op.",
  },
  {
    icon: "↩️",
    title: "Afmeld når I vil",
    text: "Ingen binding. Begge parter kan opsige med 1 måneds varsel. I bestemmer selv om I vil tilbyde gratis overnatning eller opkræve en pris per nat.",
  },
];

export default function AktiverBookingPage() {
  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-gradient-to-b from-stone-50 to-background border-b border-primary/8 px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-primary/15 text-primary/50 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            For foreninger, kommuner og naturklubber
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-primary mb-4">
            Bruger I stadig mail og Excel til at styre shelter-bookingerne?
          </h1>
          <p className="text-primary/60 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            Rigtig mange shelter-ejere bruger uforholdsmæssigt meget tid på at
            svare på forespørgsler og holde styr på hvem der kommer hvornår.
            ShelterDK tilbyder et gratis bookingsystem der klarer det for jer.
          </p>
          <a
            href="#tilmeld"
            className="inline-block bg-accent text-white font-bold px-6 py-3.5 rounded-xl hover:opacity-90 transition shadow-sm"
          >
            Se hvordan det virker →
          </a>
          <p className="mt-4 text-xs text-primary/35">
            Gratis for ejere · Ingen binding · Opsig med 1 måneds varsel
          </p>
        </div>
      </section>

      {/* Pain → solution */}
      <section className="px-4 py-16 bg-white border-b border-primary/8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-primary mb-1 text-center">
            Kender I det her?
          </h2>
          <p className="text-center text-primary/45 text-sm mb-10">
            Det er de situationer vi oftest hører fra ejere, der tilmelder sig.
          </p>
          <div className="space-y-4">
            {PAIN_POINTS.map((p) => (
              <div
                key={p.before}
                className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center bg-background rounded-xl p-4 border border-primary/8"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{p.icon}</span>
                  <p className="text-sm text-primary/70 italic">{p.before}</p>
                </div>
                <div className="hidden sm:flex text-accent font-bold text-lg justify-center">
                  →
                </div>
                <p className="text-sm text-primary/90 font-medium sm:pl-2 border-t sm:border-t-0 sm:border-l border-primary/10 pt-3 sm:pt-0 sm:pl-4">
                  {p.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="px-4 py-16 bg-background border-b border-primary/8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-primary mb-1 text-center">
            Hvad indgår i bookingsystemet?
          </h2>
          <p className="text-center text-primary/45 text-sm mb-10">
            Alt hvad I har brug for — intet I ikke har brug for.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {DETAILS.map((d) => (
              <div key={d.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-primary/10 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                  {d.icon}
                </div>
                <div>
                  <h3 className="font-bold text-primary mb-1 text-sm">
                    {d.title}
                  </h3>
                  <p className="text-primary/55 text-sm leading-relaxed">
                    {d.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Naturstyrelsen note */}
      <section className="px-4 py-10 bg-white border-b border-primary/8">
        <div className="max-w-2xl mx-auto bg-stone-50 border border-primary/10 rounded-2xl p-6">
          <p className="text-xs font-semibold text-primary/35 uppercase tracking-wider mb-2">
            Hvem er dette for?
          </p>
          <p className="text-sm text-primary/65 leading-relaxed">
            Naturstyrelsen og enkelte kommuner har allerede egne bookingsystemer
            til deres shelters. ShelterDK er til alle andre: foreninger,
            naturklubber, private lodsejere, spejdere, sportsforbund og kommuner
            der endnu ikke har et system på plads. Har I tvivl, er I velkomne
            til at skrive til{" "}
            <a
              href="mailto:hej@shelterdk.dk"
              className="underline hover:text-primary/90 transition-colors"
            >
              hej@shelterdk.dk
            </a>{" "}
            inden I tilmelder jer.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="px-4 py-16 bg-background border-b border-primary/8">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-center text-primary mb-2">
            Sådan kommer I i gang
          </h2>
          <p className="text-center text-primary/45 text-sm mb-10">
            Vi klarer opsætningen. I behøver ikke gøre andet end at udfylde
            formularen.
          </p>
          <div className="space-y-5">
            {[
              {
                n: 1,
                title: "Udfyld formularen herunder",
                sub: "Angiv navn, organisation og email. Tager under 2 minutter.",
              },
              {
                n: 2,
                title: "Vi kontakter jer inden for 1–2 hverdage",
                sub: "Vi gennemgår ansøgningen og aktiverer bookingkalenderen for jeres shelter.",
              },
              {
                n: 3,
                title: "Gæsterne kan nu booke direkte",
                sub: "I modtager en email ved hver booking. Kalenderen holder styr på resten.",
              },
            ].map((s) => (
              <div key={s.n} className="flex gap-5 items-start">
                <div className="flex-shrink-0 w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {s.n}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-primary mb-0.5 text-sm">{s.title}</h3>
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
            <h2 className="text-2xl font-bold text-primary mb-2">
              Tilmeld jeres shelter
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
