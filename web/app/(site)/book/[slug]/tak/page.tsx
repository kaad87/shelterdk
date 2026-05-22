import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forespørgsel modtaget | ShelterDK",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ guestToken?: string }>;
}

export default async function BookTakPage({ searchParams }: Props) {
  const { guestToken } = await searchParams;
  return (
    <div className="min-h-[70vh] bg-[#F9FAFB] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">

        {/* Success card */}
        <div className="rounded-2xl border border-primary/8 bg-white shadow-sm px-8 py-10 text-center">

          {/* Checkmark */}
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M7 16.5l6 6 12-13"
                stroke="#c5a059"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">Sendt!</p>
          <h1 className="font-serif text-2xl font-bold text-primary mb-3">
            Forespørgsel modtaget
          </h1>
          <p className="text-sm text-primary/55 leading-relaxed">
            Ejeren har fået besked og vender tilbage hurtigst muligt. Du modtager en bekræftelse på email.
          </p>
          {guestToken && (
            <Link
              href={`/min-booking/${encodeURIComponent(guestToken)}`}
              className="inline-block mt-5 bg-accent-dark text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-accent-dark/90 transition-colors"
            >
              Se og administrér din booking
            </Link>
          )}
        </div>

        {/* What happens next */}
        <div className="mt-6 rounded-2xl border border-primary/8 bg-white shadow-sm px-6 py-5">
          <h2 className="text-xs font-semibold text-primary/40 uppercase tracking-widest mb-4">Hvad sker der nu?</h2>
          <div className="space-y-4">
            {[
              {
                n: "1",
                title: "Du modtager en email",
                text: guestToken
                  ? "Vi har sendt en bekræftelse til din indbakke. Hvis den ikke dukker op med det samme, kan du stadig bruge knappen ovenfor."
                  : "Vi har sendt en bekræftelse til din indbakke med dine bookingdetaljer.",
              },
              {
                n: "2",
                title: "Ejeren behandler din forespørgsel",
                text: "Du hører fra ejeren inden for 24 timer med enten en bekræftelse eller afvisning.",
              },
              {
                n: "3",
                title: "Pak tasken og afsted",
                text: "Når din booking er bekræftet, er pladsen din. God tur!",
              },
            ].map(({ n, title, text }) => (
              <div key={n} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-accent">{n}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary mb-0.5">{title}</p>
                  <p className="text-xs text-primary/45 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Back to ShelterDK */}
        <div className="mt-6 text-center">
          <Link
            href="/shelter-booking"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 font-medium transition-colors"
          >
            Find flere bookbare shelters →
          </Link>
        </div>

      </div>
    </div>
  );
}
