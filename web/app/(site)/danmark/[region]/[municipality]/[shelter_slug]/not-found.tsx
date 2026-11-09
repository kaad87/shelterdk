import Link from "next/link";

/**
 * 404-side for shelter-detaljeruten.
 *
 * HVORFOR ET EGET not-found.tsx HER: statuskoden sættes i generateMetadata (se
 * page.tsx), men uden en not-found-grænse I SEGMENTET blev 404-svaret udleveret
 * med en HELT TOM krop — rigtig statuskode, ingen tekst. app/not-found.tsx
 * rendrede ikke, fordi siden allerede var afbrudt. Målt: 404 med nul synlig
 * tekst og nul <h1>.
 */
export default function ShelterNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <p className="text-accent font-medium text-sm mb-3">404</p>
      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary mb-2 text-center">
        Shelteret findes ikke
      </h1>
      <p className="text-primary/70 text-center mb-8 max-w-md">
        Pladsen er måske fjernet, eller linket er forældet. Prøv kortet eller
        søgningen — vi har over 1.800 shelters og teltpladser i Danmark.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/soeg"
          className="rounded-lg bg-accent text-white font-medium px-6 py-3 hover:bg-accent/90 transition-colors"
        >
          Søg shelters
        </Link>
        <Link
          href="/shelter-naer-mig"
          className="rounded-lg border border-primary/20 text-primary font-medium px-6 py-3 hover:bg-primary/5 transition-colors"
        >
          Find shelter nær mig
        </Link>
      </div>
    </div>
  );
}
