import { describe, it, expect } from "vitest";
import {
  chooseMetaDescription,
  normalizeSeoTitle,
  truncateAtWord,
  DEFAULT_OG_IMAGE,
} from "../seo-meta";

describe("chooseMetaDescription", () => {
  it("bruger DB-værdien når den er i det gode interval (70–170 tegn)", () => {
    const db = "x".repeat(100);
    expect(chooseMetaDescription(db, "fallback")).toBe(db);
  });

  it("falder tilbage når DB-værdien er for lang (>170)", () => {
    expect(chooseMetaDescription("x".repeat(500), "fallback")).toBe("fallback");
  });

  it("falder tilbage når DB-værdien er for kort (<70)", () => {
    expect(chooseMetaDescription("Shelter- og teltområde", "fallback")).toBe("fallback");
  });

  it("falder tilbage når DB-værdien mangler", () => {
    expect(chooseMetaDescription(null, "fallback")).toBe("fallback");
    expect(chooseMetaDescription(undefined, "fallback")).toBe("fallback");
    expect(chooseMetaDescription("   ", "fallback")).toBe("fallback");
  });

  it("måler længde efter trim", () => {
    const padded = "  " + "x".repeat(100) + "  ";
    expect(chooseMetaDescription(padded, "fallback")).toBe("x".repeat(100));
  });
});

describe("normalizeSeoTitle", () => {
  it("normaliserer '| Shelterdk.dk'-suffix til '| ShelterDK'", () => {
    expect(normalizeSeoTitle("Brønden shelterplads | Shelterdk.dk", "fb")).toBe(
      "Brønden shelterplads | ShelterDK"
    );
  });

  it("lader en titel med korrekt brand stå urørt", () => {
    expect(normalizeSeoTitle("Brønden shelterplads | ShelterDK", "fb")).toBe(
      "Brønden shelterplads | ShelterDK"
    );
  });

  it("falder tilbage når DB-titlen er tom eller mangler", () => {
    expect(normalizeSeoTitle("", "fb")).toBe("fb");
    expect(normalizeSeoTitle(null, "fb")).toBe("fb");
    expect(normalizeSeoTitle("   ", "fb")).toBe("fb");
  });

  it("falder tilbage når DB-titlen er for lang til SERP (>65 tegn)", () => {
    const long = "Et meget langt shelternavn der bliver trunkeret i søgeresultaterne | Shelterdk.dk";
    expect(normalizeSeoTitle(long, "fb")).toBe("fb");
  });
});

describe("truncateAtWord", () => {
  it("lader korte tekster være urørte", () => {
    expect(truncateAtWord("kort tekst", 160)).toBe("kort tekst");
  });

  it("klipper ved ordgrænse og tilføjer ellipsis", () => {
    const out = truncateAtWord("Oplev den frodige natur i Mols Bjerge med fem shelters", 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith("…")).toBe(true);
    // må ikke ende midt i et ord (tegnet før … skal være slutningen af et helt ord)
    expect(out).toBe("Oplev den frodige natur i…");
  });

  it("håndterer tekst uden mellemrum ved hård klipning", () => {
    const out = truncateAtWord("x".repeat(200), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("DEFAULT_OG_IMAGE", () => {
  it("peger på og-default.jpg i korrekt format", () => {
    expect(DEFAULT_OG_IMAGE.url).toBe("/og-default.jpg");
    expect(DEFAULT_OG_IMAGE.width).toBe(1200);
    expect(DEFAULT_OG_IMAGE.height).toBe(630);
  });
});
