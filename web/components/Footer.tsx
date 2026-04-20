import Link from "next/link";
import { MapPin, Tent, ExternalLink } from "lucide-react";
import { CookieResetButton } from "@/components/CookieResetButton";

const footerLinks = [
  { label: "Søg shelters", href: "/soeg" },
  { label: "Tilføj manglende shelter", href: "/registrer-shelter" },
  { label: "Book shelter", href: "/shelter-booking" },
  { label: "Shelter efter område", href: "/omraade" },
  { label: "Shelter med toilet", href: "/shelter-med-toilet" },
  { label: "Shelter med vand", href: "/shelter-med-vand" },
  { label: "Vandreruter", href: "/ruteplanner" },
  { label: "Turvenner", href: "/turvenner" },
  { label: "FAQ", href: "/faq" },
  { label: "Privatliv og cookies", href: "/privacy" },
  { label: "Vilkår og betingelser", href: "/vilkaar" },
  { label: "Annoncer og partnere", href: "/annoncer-og-partnere" },
  { label: "Om os", href: "/om-os" },
  { label: "Tilbud på outdoor-grej", href: "/tilbud" },
  { label: "Blog", href: "/blog" },
  { label: "Kontakt", href: "/kontakt" },
];

const guideLinks = [
  { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
  { label: "Regler for shelter og teltning", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
  { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
  { label: "Alle guides", href: "/guides" },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
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
              Naturstyrelsen og kommunale kilder. Billeder, anmeldelser og praktisk info.
            </p>
          </div>

          {/* Sider */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Sider
            </h3>
            <ul className="space-y-2">
              {footerLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-block py-2 -my-2 text-white/75 hover:text-accent hover:underline text-sm transition-colors touch-manipulation"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <CookieResetButton />
              </li>
            </ul>
          </div>

          {/* Guides */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Guides
            </h3>
            <ul className="space-y-2">
              {guideLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-block py-2 -my-2 text-white/75 hover:text-accent hover:underline text-sm transition-colors touch-manipulation"
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
            <ul className="space-y-2">
              {externalLinks.map(({ label, href, desc }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 py-2 -my-2 text-white/75 hover:text-accent text-sm transition-colors group touch-manipulation"
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

