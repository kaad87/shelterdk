import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-white mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <Link
            href="/"
            className="font-serif text-2xl font-bold text-white hover:text-accent transition-colors"
          >
            ShelterDK
          </Link>
          <p className="text-sm text-white/80 max-w-md">
            Et lille hobbyprojekt der samler shelters i Danmark – med billeder,
            anmeldelser og praktiske detaljer.
          </p>
        </div>
        <div className="mt-8 pt-8 border-t border-white/20">
          <p className="text-sm text-white/60">
            © {currentYear} ShelterDK. Alle rettigheder forbeholdes.
          </p>
        </div>
      </div>
    </footer>
  );
}

