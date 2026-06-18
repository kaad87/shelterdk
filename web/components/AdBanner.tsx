"use client";

import { useEffect, useRef } from "react";

const CLIENT = "ca-pub-4295774462032317";

let scriptInjected = false;
function ensureScript() {
  if (typeof document === "undefined") return;
  if (scriptInjected || document.querySelector('script[src*="adsbygoogle.js"]')) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement("script");
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  s.async = true;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
  scriptInjected = true;
}

/**
 * Diskret horisontal AdSense-banner ("Annonce"). Vises altid; Google håndterer
 * samtykke/personalisering via Consent Mode + Funding Choices (uden samtykke
 * serveres ikke-personaliserede annoncer). Reserverer højde for at undgå CLS.
 * Placeres i bunden af redaktionelt indhold — ikke på affiliate-/admin-sider.
 */
export function AdBanner({ slot = "1359693016", className }: { slot?: string; className?: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    ensureScript();
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      /* AdSense ikke klar endnu — ignorér */
    }
  }, []);

  return (
    <aside className={`my-10 ${className ?? ""}`} aria-label="Annonce">
      <p className="mb-1 text-center text-[11px] uppercase tracking-wide text-primary/40">Annonce</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 90 }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
