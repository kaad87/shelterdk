"use client";

// Trin 5 — Booking opt-in. Migreret uændret fra ShelterSubmissionForm.

interface StepBookingProps {
  wantsBooking: boolean;
  setWantsBooking: (v: boolean) => void;
  bookingAccepted: boolean;
  setBookingAccepted: (v: boolean) => void;
}

export function StepBooking({
  wantsBooking,
  setWantsBooking,
  bookingAccepted,
  setBookingAccepted,
}: StepBookingProps) {
  return (
    <section className="rounded-2xl border-2 border-accent/30 bg-accent/5 overflow-hidden">
      <label className="flex items-start gap-4 p-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wantsBooking}
          onChange={(e) => {
            setWantsBooking(e.target.checked);
            if (!e.target.checked) setBookingAccepted(false);
          }}
          className="mt-0.5 w-5 h-5 rounded border-accent/40 accent-[#C5A059] flex-shrink-0"
        />
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-bold text-primary text-sm">
              Aktiver digitalt bookingsystem
            </span>
            <span className="bg-accent-dark text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              Anbefalet
            </span>
            <span className="text-xs text-accent font-semibold">Gratis</span>
          </div>
          <p className="text-sm text-primary/60">
            Lad gæsterne booke dit shelter direkte på ShelterDK — helt
            automatisk og uden administration for dig.
          </p>
        </div>
      </label>

      {wantsBooking && (
        <div className="border-t border-accent/20 px-5 pb-5 space-y-4">
          {/* Mini benefits */}
          <div className="grid sm:grid-cols-3 gap-3 pt-4">
            {[
              { icon: "🚫", label: "Ingen dobbeltbookinger" },
              { icon: "📩", label: "Automatiske bekræftelser" },
              { icon: "📊", label: "Fuldt overblik" },
            ].map((b) => (
              <div
                key={b.label}
                className="bg-white rounded-xl p-3 text-center border border-accent/15"
              >
                <div className="text-xl mb-1">{b.icon}</div>
                <p className="text-xs font-semibold text-primary">{b.label}</p>
              </div>
            ))}
          </div>

          {/* Vilkår */}
          <div className="bg-white rounded-xl p-4 border border-primary/8">
            <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider mb-2">
              Samarbejdsvilkår
            </p>
            <div className="text-xs text-primary/50 leading-relaxed space-y-1.5 max-h-32 overflow-y-auto pr-1">
              <p>
                <strong className="text-primary/70">Gratis for dig som ejer.</strong>{" "}
                Ingen oprettelsespris, abonnement eller skjulte omkostninger.
              </p>
              <p>
                <strong className="text-primary/70">Du bestemmer prisen.</strong>{" "}
                Sæt selv en pris per nat og tjen penge på dit shelter — eller stil det gratis til rådighed. Det er helt op til dig.
              </p>
              <p>
                <strong className="text-primary/70">Automatisk administration.</strong>{" "}
                ShelterDK håndterer al betaling og kommunikation med gæsten.
              </p>
              <p>
                <strong className="text-primary/70">Afmelding.</strong>{" "}
                Begge parter kan til enhver tid opsige med 1 måneds varsel.
              </p>
              <p>
                <strong className="text-primary/70">Servicegebyr.</strong>{" "}
                For at dække drift og administration opkræves et servicegebyr på
                20 kr. inkl. moms pr. gennemført booking direkte af gæsten. Du er
                ikke involveret i betalingstransaktionen.
              </p>
              <p>
                <strong className="text-primary/70">Aflysninger.</strong>{" "}
                Gæsten kan aflyse gratis op til 24 timer før. Aflyser du,
                refunderes gæsten altid fuldt ud.
              </p>
              <p>
                <strong className="text-primary/70">GDPR.</strong>{" "}
                Gæstens bookingdata (navn, kontaktinfo) deles med dig udelukkende
                til administration af overnatningerne.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={bookingAccepted}
              onChange={(e) => setBookingAccepted(e.target.checked)}
              className="mt-0.5 rounded border-primary/20 accent-[#C5A059]"
            />
            <span className="text-xs text-primary/60">
              Jeg accepterer{" "}
              <span className="underline text-primary/80 font-medium">
                samarbejdsvilkårene
              </span>{" "}
              for bookingsystemet. Spørgsmål?{" "}
              <a
                href="mailto:hej@shelterdk.dk"
                className="underline hover:text-primary/60"
              >
                hej@shelterdk.dk
              </a>
            </span>
          </label>
        </div>
      )}
    </section>
  );
}
