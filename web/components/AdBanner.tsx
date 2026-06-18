"use client";

import { useEffect, useRef, useState } from "react";
import { CONSENT_KEY, CONSENT_UPDATED_EVENT } from "@/lib/consent";

const CLIENT = "ca-pub-4295774462032317";

let scriptInjected = false;
function ensureScript() {
  if (scriptInjected || typeof document === "undefined") return;
  if (document.querySelector("script[data-adsense]")) { scriptInjected = true; return; }
  const s = document.createElement("script");
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.setAttribute("data-adsense", "1");
  document.head.appendChild(s);
  scriptInjected = true;
}

function hasMarketingConsent(): boolean {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "marketing" || v === "accept";
  } catch {
    return false;
  }
}

/**
 * Diskret horisontal AdSense-banner ("Annonce"). Vises KUN ved marketing-
 * samtykke (loader først scriptet da). Reserverer højde for at undgå CLS.
 * Placeres i bunden af redaktionelt indhold — ikke på affiliate-/admin-sider.
 */
export function AdBanner({ slot = "1359693016", className }: { slot?: string; className?: string }) {
  const [show, setShow] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    const check = () => setShow(hasMarketingConsent());
    check();
    window.addEventListener(CONSENT_UPDATED_EVENT, check);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, check);
  }, []);

  useEffect(() => {
    if (!show || pushed.current) return;
    ensureScript();
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      /* AdSense ikke klar endnu — ignorér */
    }
  }, [show]);

  if (!show) return null;

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
