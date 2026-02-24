"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const navLinks = [
  { label: "Hjem", href: "/" },
  { label: "Søg shelters", href: "/soeg" },
  { label: "Shelter nær mig", href: "/shelter-naer-mig" },
  { label: "Områder", href: "/omraade" },
  { label: "FAQ", href: "/faq" },
  { label: "Om os", href: "/om-os" },
  { label: "Blog", href: "/blog" },
  { label: "Kontakt", href: "/kontakt" },
];

function goToSoeg(q: string) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  return "/soeg" + (params.toString() ? `?${params.toString()}` : "");
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      if (fetchRef.current) {
        clearTimeout(fetchRef.current);
        fetchRef.current = null;
      }
      return;
    }
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => {
      fetchRef.current = null;
      setSuggestLoading(true);
      fetch(`/api/soeg/byer?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((arr: string[]) => {
          setSuggestions(Array.isArray(arr) ? arr : []);
          setSuggestOpen((arr?.length ?? 0) > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setSuggestOpen(false);
        })
        .finally(() => setSuggestLoading(false));
    }, 200);
    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
    };
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(goToSoeg(query));
    setSuggestOpen(false);
  };

  const pickSuggestion = (by: string) => {
    setQuery(by);
    setSuggestOpen(false);
    router.push(goToSoeg(by));
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white border-b border-primary/10 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="font-serif text-2xl font-bold text-primary hover:text-accent transition-colors"
          >
            ShelterDK
          </Link>
          <div className="hidden md:flex md:items-center md:gap-6">
            {navLinks.map(({ label, href }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? "text-accent"
                      : "text-primary/80 hover:text-accent"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="relative w-56 lg:w-64" ref={suggestRef}>
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 rounded-lg border border-primary/15 bg-primary/[0.03] focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => setTimeout(() => setSuggestOpen(false), 180)}
                  placeholder="Søg område eller by"
                  className="flex-1 min-w-0 py-2 pl-3 pr-2 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-primary placeholder:text-primary/50"
                  aria-label="Søg efter område eller by"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center w-9 h-9 shrink-0 text-accent hover:bg-accent/10 rounded-r-md transition-colors"
                  aria-label="Søg"
                >
                  <Search size={18} />
                </button>
              </form>
              {suggestOpen && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-[100] mt-1 py-1 bg-white border border-primary/10 rounded-lg shadow-lg max-h-60 overflow-auto"
                >
                  {suggestLoading ? (
                    <li className="px-3 py-2 text-primary/60 text-sm">Henter…</li>
                  ) : (
                    suggestions.map((by) => (
                      <li
                        key={by}
                        role="option"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickSuggestion(by);
                        }}
                        className="px-3 py-2 text-sm text-primary hover:bg-primary/5 cursor-pointer"
                      >
                        {by}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
          <button
            className="md:hidden flex items-center justify-center w-12 h-12 -mr-2 text-primary touch-manipulation"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Luk menu" : "Åbn menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 -mx-4 px-4 border-t border-primary/10 mt-2">
            <div className="flex flex-col gap-1">
              {navLinks.map(({ label, href }) => {
                const isActive =
                  href === "/"
                    ? pathname === "/"
                    : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block py-3 px-4 text-base font-medium rounded-lg transition-colors touch-manipulation -mx-2 ${
                      isActive
                        ? "text-accent bg-accent/10"
                        : "text-primary/80 hover:text-accent hover:bg-primary/5 active:bg-primary/10"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              <form onSubmit={(e) => { e.preventDefault(); router.push(goToSoeg(query)); setMobileMenuOpen(false); }} className="flex gap-2 px-2 mt-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Søg område eller by"
                  className="flex-1 min-w-0 py-2.5 px-3 text-base rounded-lg border border-primary/15 bg-white text-primary placeholder:text-primary/50"
                  aria-label="Søg efter område eller by"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center w-12 rounded-lg bg-accent text-white shrink-0 touch-manipulation"
                  aria-label="Søg"
                >
                  <Search size={20} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

