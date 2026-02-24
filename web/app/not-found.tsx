import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary mb-2">
        Siden blev ikke fundet
      </h1>
      <p className="text-primary/70 text-center mb-8 max-w-md">
        Den side du leder efter findes ikke eller er flyttet. Brug linket nedenfor
        til at komme til forsiden eller søg efter shelters.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/"
          className="rounded-lg bg-accent text-white font-medium px-6 py-3 hover:bg-accent/90 transition-colors"
        >
          Gå til forsiden
        </Link>
        <Link
          href="/soeg"
          className="rounded-lg border border-primary/20 text-primary font-medium px-6 py-3 hover:bg-primary/5 transition-colors"
        >
          Søg shelters
        </Link>
      </div>
    </div>
  );
}
