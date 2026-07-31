"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay";
import { useShelterTipModal } from "@/components/ShelterTipModalProvider";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const navEntries: NavEntry[] = [
  {
    label: "Find shelter",
    items: [
      { label: "Søg shelters", href: "/soeg" },
      { label: "Regioner", href: "/danmark" },
      { label: "Byer med shelters", href: "/by" },
      { label: "Shelter nær mig", href: "/shelter-naer-mig" },
      { label: "Områder", href: "/omraade" },
      { label: "Book shelter", href: "/shelter-booking" },
      { label: "Handicapvenlige shelters", href: "/handicapvenlige-shelters" },
      { label: "Shelter til familier", href: "/shelter-til-familier" },
      { label: "Shelter til cykeltur", href: "/shelter-til-cykeltur" },
    ],
  },
  { label: "Ruteplanner", href: "/ruteplanner" },
  { label: "Tilbud", href: "/tilbud" },
  { label: "Turvenner", href: "/turvenner" },
  {
    label: "Inspiration",
    items: [
      { label: "Guides", href: "/guides" },
      { label: "Bedste grej (køb)", href: "/bedste" },
      { label: "Fakta", href: "/fakta" },
      { label: "Pakkeliste", href: "/guides/pakkeliste-til-sheltertur" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    label: "Om os",
    items: [
      { label: "Om os", href: "/om-os" },
      { label: "FAQ", href: "/faq" },
      { label: "Kontakt", href: "/kontakt" },
    ],
  },
];

function goToSoeg(q: string) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  return "/soeg" + (params.toString() ? `?${params.toString()}` : "");
}

function DropdownMenu({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isGroupActive = group.items.some(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          isGroupActive
            ? "text-accent"
            : "text-primary/80 hover:text-accent"
        } rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2`}
        onClick={() => setOpen(!open)}
        aria-label={`${group.label} menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {group.label}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          id={`nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="absolute left-0 top-full z-[100] mt-2 min-w-[180px] rounded-lg border border-primary/10 bg-white py-1 shadow-lg"
        >
          {group.items.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "text-accent bg-accent/5"
                    : "text-primary/80 hover:text-accent hover:bg-primary/5"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openModal } = useShelterTipModal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Lås baggrunds-scroll mens burger-menuen er åben. Uden dette scroller siden
  // bagved når man swiper i menuen (scroll-chaining), fordi menuen er en del af
  // den sticky nav og bliver højere end viewporten på mobil.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; type: "by" | "område" }[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      if (fetchRef.current) {
        clearTimeout(fetchRef.current);
        fetchRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return;
    }
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => {
      fetchRef.current = null;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSuggestLoading(true);
      fetch(`/api/soeg/byer?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((arr: unknown) => {
          const items: { name: string; type: "by" | "område" }[] = Array.isArray(arr)
            ? arr.length > 0 && typeof arr[0] === "string"
              ? (arr as string[]).map((name) => ({ name, type: "by" as const }))
              : (arr as any[])
                  .map((s) => ({
                    name: String(s?.name ?? ""),
                    type: s?.type === "område" ? ("område" as const) : ("by" as const),
                  }))
                  .filter((s) => s.name.trim().length > 0)
            : [];
          setSuggestions(items);
          setSuggestOpen(items.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setSuggestOpen(false);
        })
        .finally(() => setSuggestLoading(false));
    }, 200);
    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
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

  // Flatten all links for mobile menu
  const allLinks = navEntries.flatMap((entry) =>
    isGroup(entry) ? entry.items : [entry]
  );

  return (
    <nav aria-label="Primær navigation" className="sticky top-0 z-50 w-full bg-white border-b border-primary/10 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="font-serif text-2xl font-bold text-primary hover:text-accent transition-colors"
          >
            ShelterDK
          </Link>
          <div className="hidden md:flex md:items-center md:gap-6">
            {navEntries.map((entry) => {
              if (isGroup(entry)) {
                return (
                  <DropdownMenu
                    key={entry.label}
                    group={entry}
                    pathname={pathname}
                  />
                );
              }
              const isActive =
                pathname === entry.href ||
                pathname.startsWith(entry.href + "/");
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? "text-accent"
                      : "text-primary/80 hover:text-accent"
                  }`}
                >
                  {entry.label}
                </Link>
              );
            })}
            <button
              onClick={openModal}
              className="hidden lg:flex items-center gap-1.5 bg-accent-dark text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg hover:bg-accent/85 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
            >
              <span>💡</span>
              Mangler dit shelter?
            </button>
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
                  aria-autocomplete="list"
                  aria-controls="navbar-search-suggestions"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center w-9 h-9 shrink-0 text-accent hover:bg-accent/10 rounded-r-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset"
                  aria-label="Søg"
                >
                  <Search size={18} />
                </button>
              </form>
              {suggestOpen && (
                <ul
                  id="navbar-search-suggestions"
                  role="listbox"
                  aria-label="Søgeforslag"
                  className="absolute left-0 right-0 top-full z-[100] mt-1 py-1 bg-white border border-primary/10 rounded-lg shadow-lg max-h-60 overflow-auto"
                >
                  {suggestLoading ? (
                    <li className="px-3 py-2 text-primary/60 text-sm">Henter…</li>
                  ) : (
                    suggestions.map((s) => (
                      <li
                        key={`${s.type}-${s.name}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickSuggestion(s.name);
                        }}
                        className="px-0"
                      >
                        <button
                          type="button"
                          onClick={() => pickSuggestion(s.name)}
                          role="option"
                          aria-selected={false}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm text-primary hover:bg-primary/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset"
                        >
                          <span>{s.name}</span>
                          <span className="text-xs text-primary/50 ml-2">
                            {s.type === "område" ? "Område" : "By"}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="md:hidden flex items-center gap-1 -mr-2">
            <button
              className="flex items-center justify-center w-11 h-11 text-primary touch-manipulation rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Søg"
            >
              <Search size={22} />
            </button>
            <button
              className="flex items-center justify-center w-11 h-11 text-primary touch-manipulation rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Luk menu" : "Åbn menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          {mobileSearchOpen && (
            <MobileSearchOverlay onClose={() => setMobileSearchOpen(false)} />
          )}
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 -mx-4 px-4 border-t border-primary/10 mt-2 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-1">
              {navEntries.map((entry) => {
                if (isGroup(entry)) {
                  return (
                    <div key={entry.label}>
                      <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-primary/40">
                        {entry.label}
                      </div>
                      {entry.items.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block py-3 px-4 text-base font-medium rounded-lg transition-colors touch-manipulation -mx-2 ${
                              isActive
                                ? "text-accent bg-accent/10"
                                : "text-primary/80 hover:text-accent hover:bg-primary/5 active:bg-primary/10"
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }
                const isActive =
                  pathname === entry.href ||
                  pathname.startsWith(entry.href + "/");
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block py-3 px-4 text-base font-medium rounded-lg transition-colors touch-manipulation -mx-2 ${
                      isActive
                        ? "text-accent bg-accent/10"
                        : "text-primary/80 hover:text-accent hover:bg-primary/5 active:bg-primary/10"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset`}
                  >
                    {entry.label}
                  </Link>
                );
              })}
              <button
                onClick={() => { openModal(); setMobileMenuOpen(false); }}
                className="block w-full text-left py-3 px-4 text-base font-medium rounded-lg transition-colors touch-manipulation -mx-2 text-accent hover:bg-accent/5 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset"
              >
                💡 Mangler dit shelter?
              </button>
              <form onSubmit={(e) => { e.preventDefault(); router.push(goToSoeg(query)); setMobileMenuOpen(false); }} className="flex gap-2 px-2 mt-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Søg område eller by"
                  className="flex-1 min-w-0 py-2.5 px-3 text-base rounded-lg border border-primary/15 bg-white text-primary placeholder:text-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent/50"
                  aria-label="Søg efter område eller by"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center w-12 rounded-lg bg-accent-dark text-white shrink-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
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
