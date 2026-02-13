"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { label: "Hjem", href: "/" },
  { label: "Søg shelters", href: "/soeg" },
  { label: "FAQ", href: "/faq" },
  { label: "Om os", href: "/om-os" },
  { label: "Blog", href: "/blog" },
  { label: "Kontakt", href: "/kontakt" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <div className="hidden md:flex md:items-center md:gap-8">
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
          </div>
          <button
            className="md:hidden text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
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
                  className={`block px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "text-accent bg-accent/10"
                      : "text-primary/80 hover:text-accent hover:bg-primary/5"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

