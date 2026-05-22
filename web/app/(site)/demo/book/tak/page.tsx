import Link from "next/link";

export default function DemoTakPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">

        {/* Demo banner */}
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-center">
          <p className="text-xs font-semibold text-amber-700">
            Demo — ingen rigtig booking er oprettet
          </p>
        </div>

        {/* Success card */}
        <div className="rounded-2xl border border-primary/8 bg-white shadow-sm px-8 py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M7 16.5l6 6 12-13" stroke="#c5a059" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">Sendt!</p>
          <h1 className="font-serif text-2xl font-bold text-primary mb-3">
            Forespørgsel modtaget
          </h1>
          <p className="text-sm text-primary/55 leading-relaxed">
            I et rigtigt forløb ville gæsten nu modtage en bekræftelse på email, og du som ejer ville få besked med navn, dato og kontaktinfo.
          </p>
        </div>

        {/* What happens next */}
        <div className="mt-6 rounded-2xl border border-primary/8 bg-white shadow-sm px-6 py-5">
          <h2 className="text-xs font-semibold text-primary/40 uppercase tracking-widest mb-4">Hvad sker der i virkeligheden?</h2>
          <div className="space-y-4">
            {[
              {
                n: "1",
                title: "Gæsten modtager en bekræftelse",
                text: "En automatisk email med bookingdetaljer sendes med det samme — du behøver ikke gøre noget.",
              },
              {
                n: "2",
                title: "Du får besked som ejer",
                text: "Du modtager gæstens navn, email og dato. Kalenderens dage lukkes automatisk.",
              },
              {
                n: "3",
                title: "Gæsten ankommer — ingen overraskelser",
                text: "Ingen dobbeltbookinger. Ingen uventede gæster. Ingen mails frem og tilbage.",
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

        <div className="mt-6 text-center">
          <Link
            href="/aktiver-booking"
            className="inline-block bg-accent-dark text-white text-sm font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-colors shadow-sm"
          >
            Aktiver booking til dit shelter →
          </Link>
          <p className="mt-3 text-xs text-primary/35">Gratis · Ingen binding · Opsig med 1 måneds varsel</p>
        </div>

      </div>
    </div>
  );
}
