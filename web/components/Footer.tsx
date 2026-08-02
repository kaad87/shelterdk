import Link from "next/link";
import { MapPin, Tent, ExternalLink } from "lucide-react";
import { CookieResetButton } from "@/components/CookieResetButton";
import NewsletterSignup from "@/components/NewsletterSignup";
import { hasPublishedStayGuides } from "@/lib/nature-stays";

const discoverLinks = [
  { label: "Shelter efter region", href: "/danmark" },
  { label: "Byer med shelters", href: "/by" },
  { label: "Shelter efter område", href: "/omraade" },
  { label: "Book shelter", href: "/shelter-booking" },
  { label: "Shelter med toilet", href: "/shelter-med-toilet" },
  { label: "Shelter med vand", href: "/shelter-med-vand" },
  { label: "Handicapvenlige shelters", href: "/handicapvenlige-shelters" },
  { label: "Shelter til familier", href: "/shelter-til-familier" },
  { label: "Shelter til cykeltur", href: "/shelter-til-cykeltur" },
  { label: "Teltpladser", href: "/teltplads" },
  { label: "Bålhytter", href: "/baalhytte" },
  { label: "Arla ØKO Shelters", href: "/arla-oeko-shelter" },
];

const contentLinks = [
  { label: "Alle guides", href: "/guides" },
  { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
  { label: "Regler for shelter og teltning", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
  { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere-forste-tur" },
  { label: "Shelters langs Hærvejen", href: "/haervejen" },
  { label: "Shelters ved Gudenåen", href: "/gudenaaen" },
  { label: "Fakta om shelters", href: "/fakta" },
  { label: "Blog", href: "/blog" },
];

const gearGuideLinks = [
  { label: "Bedste outdoor-grej", href: "/bedste" },
  { label: "Bedste sovepose", href: "/bedste/sovepose" },
  { label: "Bedste liggeunderlag", href: "/bedste/liggeunderlag" },
  { label: "Bedste pandelampe", href: "/bedste/pandelampe" },
  { label: "Bedste telt", href: "/bedste/telt" },
  { label: "Køb shelter – priser og regler", href: "/koeb-shelter" },
];

const companyLinks = [
  { label: "Tilføj manglende shelter", href: "/registrer-shelter" },
  { label: "Aktivér booking (shelter-ejere)", href: "/aktiver-booking" },
  { label: "Vandreruter", href: "/ruteplanner" },
  { label: "Turvenner", href: "/turvenner" },
  { label: "Annoncer og partnere", href: "/annoncer-og-partnere" },
  { label: "Om os", href: "/om-os" },
  { label: "Kontakt", href: "/kontakt" },
];

const legalLinks = [
  { label: "FAQ", href: "/faq" },
  { label: "Privatlivspolitik", href: "/privacy" },
  { label: "Vilkår og betingelser", href: "/vilkaar" },
  { label: "Tilbud på outdoor-grej", href: "/tilbud" },
];

const externalLinks = [
  { label: "Udinaturen.dk", href: "https://udinaturen.dk", desc: "Booking og info" },
  { label: "GeoFA", href: "https://geofa.geodanmark.dk", desc: "Geografiske data" },
  { label: "Naturstyrelsen", href: "https://naturstyrelsen.dk", desc: "Natur og shelter" },
];

const headingClass = "mb-4 text-sm font-semibold uppercase tracking-wider text-white";
const linkClass =
  "inline-block py-2 text-sm text-white/75 transition-colors hover:text-accent hover:underline touch-manipulation";

export async function Footer() {
  const currentYear = new Date().getFullYear();
  // Vis kun naturophold-link når der ér indhold (undgå link til tom hub).
  const showNatureStays = await hasPublishedStayGuides().catch(() => false);

  return (
    <footer className="mt-auto bg-primary text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-6 lg:gap-12">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-serif text-2xl font-bold text-white transition-colors hover:text-accent"
            >
              <Tent className="h-7 w-7 text-accent" aria-hidden="true" />
              <span>ShelterDK</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/80">
              Find dit næste shelter i Danmark – ét samlet kort over naturovernatning fra GeoFA,
              Naturstyrelsen og kommunale kilder. Billeder, anmeldelser og praktisk info.
            </p>
            <div className="mt-5 max-w-sm">
              <p className="mb-2 text-sm font-semibold text-white">
                Få nye shelters og turtips på mail
              </p>
              <NewsletterSignup variant="compact" source="footer" className="!bg-white !border-white/20" />
            </div>
          </div>

          <nav aria-labelledby="footer-discover-heading">
            <h2 id="footer-discover-heading" className={headingClass}>
              Find shelters
            </h2>
            <ul className="space-y-2">
              {discoverLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-content-heading">
            <h2 id="footer-content-heading" className={headingClass}>
              Inspiration
            </h2>
            <ul className="space-y-2">
              {contentLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
              {gearGuideLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
              {showNatureStays && (
                <li>
                  <Link href="/naturophold" className={linkClass}>
                    Glamping & naturophold
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company-heading">
            <h2 id="footer-company-heading" className={headingClass}>
              Om ShelterDK
            </h2>
            <ul className="space-y-2">
              {companyLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
              {legalLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <CookieResetButton className="hover:text-accent" />
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-external-heading">
            <h2 id="footer-external-heading" className={headingClass}>
              Eksterne ressourcer
            </h2>
            <ul className="space-y-2">
              {externalLinks.map(({ label, href, desc }) => (
                <li key={href}>
                  {(() => {
                    const descId = `footer-external-${label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")}-desc`;

                    return (
                      <>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-describedby={descId}
                          className="inline-flex items-center gap-1.5 py-2 text-sm text-white/75 transition-colors hover:text-accent"
                        >
                          <span>{label}</span>
                          <ExternalLink
                            size={12}
                            className="opacity-60"
                            aria-hidden="true"
                          />
                          <span className="sr-only">(åbner i nyt faneblad)</span>
                        </a>
                        <span id={descId} className="mt-0.5 block text-xs text-white/50">
                          {desc}
                        </span>
                      </>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/20 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/60">
            © {currentYear} ShelterDK. Et hobbyprojekt – data fra GeoFA og andre offentlige kilder.
          </p>
          <p className="flex items-center gap-1 text-xs text-white/50">
            <MapPin size={12} aria-hidden="true" />
            <span>Shelters i hele Danmark</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
