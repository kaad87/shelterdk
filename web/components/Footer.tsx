import Link from "next/link";
import { MapPin, Tent, ExternalLink } from "lucide-react";

const footerLinks = [
  { label: "Søg shelters", href: "/soeg" },
  { label: "FAQ", href: "/faq" },
  { label: "Om os", href: "/om-os" },
  { label: "Blog", href: "/blog" },
  { label: "Kontakt", href: "/kontakt" },
];

const externalLinks = [
  { label: "Udinaturen.dk", href: "https://udinaturen.dk", desc: "Booking og info" },
  { label: "GeoFA", href: "https://geofa.geodanmark.dk", desc: "Geografiske data" },
  { label: "Naturstyrelsen", href: "https://naturstyrelsen.dk", desc: "Natur og shelter" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-white mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-serif text-2xl font-bold text-white hover:text-accent transition-colors"
            >
              <Tent className="w-7 h-7 text-accent" aria-hidden />
              ShelterDK
            </Link>
            <p className="mt-3 text-white/80 text-sm leading-relaxed max-w-sm">
              Find dit næste shelter i Danmark – ét samlet kort over naturovernatning fra GeoFA,
              Naturstyrelsen, Book en Shelter og flere. Billeder, anmeldelser og praktisk info.
            </p>
          </div>

          {/* Sider */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Sider
            </h3>
            <ul className="space-y-3">
              {footerLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-white/75 hover:text-accent hover:underline text-sm transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Eksterne links */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Eksterne ressourcer
            </h3>
            <ul className="space-y-3">
              {externalLinks.map(({ label, href, desc }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-white/75 hover:text-accent text-sm transition-colors group"
                  >
                    {label}
                    <ExternalLink size={12} className="opacity-60 group-hover:opacity-100" aria-hidden />
                  </a>
                  <span className="block text-white/50 text-xs mt-0.5">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-white/60 text-sm">
            © {currentYear} ShelterDK. Et hobbyprojekt – data fra GeoFA og andre offentlige kilder.
          </p>
          <p className="text-white/50 text-xs flex items-center gap-1">
            <MapPin size={12} aria-hidden />
            Shelters i hele Danmark
          </p>
        </div>
      </div>
    </footer>
  );
}

