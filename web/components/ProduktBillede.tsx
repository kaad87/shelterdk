"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

/**
 * Produktbillede med reserve, naar feedets billed-URL ikke svarer.
 *
 * Maalt 8. november 2026 pegede 11 af de 362 varer i udgivne guider paa
 * filer backpackerlife har slettet. Alle 11 viste en brudt billedkasse med
 * alt-teksten i, baade paa guidekortene, i sammenligningstabellen og paa
 * produktsiden.
 *
 * Det kan ikke rettes i databasen: synken skriver image_url igen hver nat
 * (scripts/sync-affiliate-products.ts), saa en rettet raekke er vaek kl. 03.
 * Det kan heller ikke loeses ved at laane et andet produktfoto. Kun 4 af de
 * 11 findes overhovedet hos en anden butik, og de fire er andre farver
 * (Spork "rockyred" i stedet for BIO). Paa et affiliate-site er billedet et
 * koebssignal, saa et forkert foto er vaerre end ingen foto.
 *
 * Reserven er derfor et neutralt felt i samme stoerrelse som billedet, saa
 * opstillingen ikke skrider. Den daekker ogsaa den naeste butik der rydder
 * op i sine filer, uden at nogen skal opdage det foerst.
 */
export function ProduktBillede({
  src,
  alt,
  className,
  sizes,
  priority = false,
  fill = false,
  width,
  height,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Fylder en foraeldre med position: relative, som next/image fill. */
  fill?: boolean;
  width?: number;
  height?: number;
}) {
  const [fejlet, setFejlet] = useState(false);
  const url = (src ?? "").trim();

  if (!url || fejlet) {
    return (
      <div
        // Ved fill ligger billedet oven i en relativ foraelder, og reserven
        // skal daekke den samme flade. Ellers arver den billedets egne
        // stoerrelsesklasser.
        className={`flex items-center justify-center bg-primary/5 ${
          fill ? "absolute inset-0" : (className ?? "")
        }`}
        style={fill ? undefined : { width, height }}
        // Navnet staar altid som tekst ved siden af, men et tomt felt uden
        // navn er intet vaerd for en skaermlaeser naar alt-teksten var sat.
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <ImageOff className="h-1/4 w-1/4 min-h-3 min-w-3 max-h-8 max-w-8 text-primary/25" />
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      {...(fill ? { fill: true } : { width: width!, height: height! })}
      className={className}
      sizes={sizes}
      priority={priority}
      // unoptimized er husets moenster for affiliate-billeder: det springer
      // remotePatterns over, saa de otte butiksvaerter ikke skal staa i
      // next.config.js.
      unoptimized
      onError={() => setFejlet(true)}
    />
  );
}
