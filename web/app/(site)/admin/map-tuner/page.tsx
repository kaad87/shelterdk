"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShelterMap } from "@/components/ShelterMap";

export default function MapTunerPage() {
  const [scale, setScale] = useState(1.3);
  const [shiftY, setShiftY] = useState(-5);
  const [height, setHeight] = useState(200);
  const [shelters, setShelters] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/soeg?limit=200")
      .then((r) => r.json())
      .then((d) => setShelters(d.shelters ?? []));
  }, []);

  // Apply CSS custom properties to document root
  useEffect(() => {
    document.documentElement.style.setProperty("--map-scale", String(scale));
    document.documentElement.style.setProperty("--map-shift-y", `${shiftY}px`);
    document.documentElement.style.setProperty("--map-height", `${height}px`);
  }, [scale, shiftY, height]);

  const cssOutput = `/* Compact map values */
--map-scale: ${scale};
--map-shift-y: ${shiftY}px;
--map-height: ${height}px;`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Map Tuner</span>
      </nav>

      <h1 className="font-serif text-2xl font-bold text-primary mb-6">Kort-indstillinger (mobil)</h1>

      {/* Preview: simulates the compact map container */}
      <div className="mb-6 rounded-xl overflow-hidden border border-primary/10 bg-primary/5 relative"
        style={{ height: `${height}px` }}>
        <div style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          transform: `scale(${scale}) translateY(${shiftY}px)`,
          transformOrigin: "center center",
        }}>
          <ShelterMap
            shelters={shelters}
            className="absolute inset-0 w-full h-full"
            fitWholeDenmarkOnLoad
          />
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-5 bg-white rounded-xl border border-primary/10 p-5">
        <div>
          <label className="flex items-center justify-between text-sm font-medium text-primary mb-1">
            <span>Zoom (scale)</span>
            <span className="font-mono text-primary/60">{scale.toFixed(2)}</span>
          </label>
          <input type="range" min="0.5" max="2.0" step="0.05"
            value={scale} onChange={(e) => setScale(Number(e.target.value))}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-primary/40 mt-0.5">
            <span>0.5 (langt ud)</span><span>2.0 (meget tæt)</span>
          </div>
        </div>

        <div>
          <label className="flex items-center justify-between text-sm font-medium text-primary mb-1">
            <span>Nord/syd-forskydning</span>
            <span className="font-mono text-primary/60">{shiftY}px</span>
          </label>
          <input type="range" min="-80" max="40" step="1"
            value={shiftY} onChange={(e) => setShiftY(Number(e.target.value))}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-primary/40 mt-0.5">
            <span>-80 (mere nord)</span><span>+40 (mere syd)</span>
          </div>
        </div>

        <div>
          <label className="flex items-center justify-between text-sm font-medium text-primary mb-1">
            <span>Korthøjde</span>
            <span className="font-mono text-primary/60">{height}px</span>
          </label>
          <input type="range" min="140" max="300" step="5"
            value={height} onChange={(e) => setHeight(Number(e.target.value))}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-primary/40 mt-0.5">
            <span>140px</span><span>300px</span>
          </div>
        </div>
      </div>

      {/* CSS Output */}
      <div className="mt-6 bg-primary/5 rounded-xl border border-primary/10 p-4">
        <p className="text-sm font-medium text-primary mb-2">
          Kopiér disse værdier til <code className="text-accent">globals.css</code> under <code className="text-accent">:root</code>:
        </p>
        <pre className="bg-white rounded-lg p-3 text-sm font-mono text-primary/80 border border-primary/10 select-all">
          {cssOutput}
        </pre>
      </div>
    </div>
  );
}
