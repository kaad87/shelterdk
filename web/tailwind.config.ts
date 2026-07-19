import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2C3E50",
        accent: "#C5A059",
        // Darker gold for CTAs + body links — WCAG AA compliant on white (5.05:1).
        // Keeps the brand gold feel but readable as text or CTA background.
        "accent-dark": "#8A6A26",
        background: "#F9FAFB",
        "muted-foreground": "#6B7280",
        // Nordisk naturgrøn — samlet token for de tidligere hardcodede
        // skov-gradients (mobil-hero, region-kort), så hele sitet deler
        // én rolig naturpalette (skifer + guld + gran).
        pine: { DEFAULT: "#2C3E2D", dark: "#1A2B1A", light: "#4A6B4A" },
      },
      fontFamily: {
        // "Ampersand" forrest gør at KUN &-tegnet bruger Georgia (se @font-face
        // i globals.css med unicode-range U+0026) — resten forbliver Playfair.
        serif: ["Ampersand", "var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "translateY(-4px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.4s ease-out both",
        "pop-in": "popIn 0.15s ease-out both",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;

