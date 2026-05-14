"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { ShelterSubmission, FacilityKey } from "@/lib/shelter-submissions";
import { FACILITY_LABELS } from "@/lib/shelter-submissions";

const STORAGE_KEY = "shelterdk-admin-secret";

// ─── Leaflet admin review map ──────────────────────────────────────────────

const AdminMapPicker = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, useMapEvents } = await import(
      "react-leaflet"
    );
    const L = await import("leaflet");

    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    return function Inner({
      lat,
      lng,
      onChange,
    }: {
      lat: number | null;
      lng: number | null;
      onChange: (lat: number, lng: number) => void;
    }) {
      function ClickHandler() {
        useMapEvents({
          click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }
      const center: [number, number] =
        lat != null && lng != null ? [lat, lng] : [56.0, 10.0];
      return (
        <MapContainer
          center={center}
          zoom={lat != null ? 13 : 6}
          style={{ height: 250, width: "100%" }}
          className="rounded-xl z-0 [&_.leaflet-control-attribution]:text-[10px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={icon} />
          )}
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

// ─── Types ─────────────────────────────────────────────────────────────────

type Submission = ShelterSubmission & {
  photo_preview_urls: (string | null)[];
};

// ─── Main page component ────────────────────────────────────────────────────

export default function ShelterAnsogningerPage() {
  const [secret] = useState<string>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY) ?? ""
      : ""
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Review panel state
  const [reviewLat, setReviewLat] = useState<number | null>(null);
  const [reviewLng, setReviewLng] = useState<number | null>(null);
  const [region, setRegion] = useState("");
  const [kommune, setKommune] = useState("");
  const [place, setPlace] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectField, setShowRejectField] = useState(false);
  const [busy, setBusy] = useState(false);

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-secret": secret }),
    [secret]
  );

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/pending-shelter-submissions", {
        headers: { "x-admin-secret": secret },
      });
      if (res.status === 401) {
        setAuthError(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ukendt fejl");
      setSubmissions(data.submissions ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fejl ved indlæsning");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openReview(sub: Submission) {
    setExpandedId(sub.id);
    setReviewLat(sub.lat);
    setReviewLng(sub.lng);
    setRegion("");
    setKommune("");
    setPlace("");
    setRejectReason("");
    setShowRejectField(false);
  }

  function closeReview() {
    setExpandedId(null);
    setShowRejectField(false);
  }

  async function handleApprove(sub: Submission) {
    if (!region.trim()) return;
    if (reviewLat == null || reviewLng == null) {
      setBanner({ type: "err", msg: "Sæt koordinater på kortet før godkendelse" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/approve-shelter-submission", {
        method: "POST",
        headers,
        body: JSON.stringify({
          submissionId: sub.id,
          region: region.trim(),
          kommune: kommune.trim(),
          place: place.trim(),
          lat: reviewLat,
          lng: reviewLng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Godkendelse fejlede");
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      closeReview();
      setBanner({
        type: data.warning ? "err" : "ok",
        msg: data.warning ?? `✅ ${sub.shelter_name} er nu live!`,
      });
    } catch (err) {
      setBanner({ type: "err", msg: err instanceof Error ? err.message : "Fejl" });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(sub: Submission) {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reject-shelter-submission", {
        method: "POST",
        headers,
        body: JSON.stringify({ submissionId: sub.id, reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Afvisning fejlede");
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      closeReview();
      setBanner({ type: "ok", msg: `Ansøgning fra ${sub.shelter_name} afvist.` });
    } catch (err) {
      setBanner({ type: "err", msg: err instanceof Error ? err.message : "Fejl" });
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-red-600 text-sm">
          Ingen adgang — log ind med admin-nøglen på{" "}
          <Link href="/admin" className="underline">
            admin-siden
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Shelter-ansøgninger</span>
      </nav>

      <h1 className="text-2xl font-bold text-primary mb-6">Shelter-ansøgninger</h1>

      {banner && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            banner.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {banner.msg}
          <button
            onClick={() => setBanner(null)}
            className="ml-3 text-xs underline opacity-70"
          >
            Luk
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-primary/50">Indlæser...</p>}
      {errorMsg && <p className="text-sm text-red-600 mb-4">{errorMsg}</p>}

      {!loading && submissions.length === 0 && !errorMsg && (
        <p className="text-sm text-primary/50">Ingen afventende ansøgninger.</p>
      )}

      <div className="space-y-4">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="rounded-xl border border-primary/10 bg-white overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-semibold text-primary">{sub.shelter_name}</p>
                <p className="text-xs text-primary/50 mt-0.5">
                  {sub.location_text} ·{" "}
                  {new Date(sub.created_at).toLocaleDateString("da-DK")}
                  {sub.photo_urls.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-primary/5 rounded px-1.5 py-0.5 text-primary/60">
                      📷 {sub.photo_urls.length}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() =>
                  expandedId === sub.id ? closeReview() : openReview(sub)
                }
                className="text-sm text-accent hover:underline font-medium"
              >
                {expandedId === sub.id ? "Luk" : "Gennemgå"}
              </button>
            </div>

            {/* Expanded review panel */}
            {expandedId === sub.id && (
              <div className="border-t border-primary/10 px-5 pb-6 pt-5 space-y-5">
                {/* Submission details */}
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-primary/50 text-xs">Type</dt>
                    <dd className="text-primary">{sub.type}</dd>
                  </div>
                  <div>
                    <dt className="text-primary/50 text-xs">Kapacitet</dt>
                    <dd className="text-primary">{sub.capacity ?? "—"}</dd>
                  </div>
                  {sub.booking_url && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs">Booking-URL</dt>
                      <dd>
                        <a
                          href={sub.booking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline text-xs"
                        >
                          {sub.booking_url}
                        </a>
                      </dd>
                    </div>
                  )}
                  {sub.contact_email && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs">Kontakt</dt>
                      <dd className="text-primary text-xs">
                        {sub.contact_name && <>{sub.contact_name} · </>}
                        {sub.contact_email}
                      </dd>
                    </div>
                  )}
                  {sub.description && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs">Beskrivelse</dt>
                      <dd className="text-primary text-xs whitespace-pre-wrap">
                        {sub.description}
                      </dd>
                    </div>
                  )}
                  {sub.facilities && Object.keys(sub.facilities).length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-primary/50 text-xs mb-1">Faciliteter</dt>
                      <dd className="flex flex-wrap gap-2">
                        {(
                          Object.entries(sub.facilities) as [FacilityKey, boolean][]
                        )
                          .filter(([, v]) => v)
                          .map(([k]) => (
                            <span
                              key={k}
                              className="text-xs bg-primary/5 rounded px-2 py-0.5"
                            >
                              {FACILITY_LABELS[k]}
                            </span>
                          ))}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Photos */}
                {sub.photo_urls.length > 0 && (
                  <div>
                    <p className="text-xs text-primary/50 mb-2">Billeder</p>
                    <div className="flex flex-wrap gap-2">
                      {sub.photo_urls.map((path, i) => {
                        const previewUrl = sub.photo_preview_urls?.[i];
                        return previewUrl ? (
                          <a
                            key={path}
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-20 h-20 rounded-lg overflow-hidden border border-primary/10 hover:opacity-90 transition-opacity"
                          >
                            <img
                              src={previewUrl}
                              alt={`Billede ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ) : (
                          <div
                            key={path}
                            className="w-20 h-20 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-xs text-primary/40"
                          >
                            📷
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Map */}
                <div>
                  <p className="text-xs text-primary/50 mb-2">
                    Koordinater (klik på kortet for at justere){" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <AdminMapPicker
                    lat={reviewLat}
                    lng={reviewLng}
                    onChange={(lat, lng) => {
                      setReviewLat(lat);
                      setReviewLng(lng);
                    }}
                  />
                  {reviewLat != null && reviewLng != null && (
                    <p className="text-xs text-primary/40 mt-1">
                      {reviewLat.toFixed(5)}, {reviewLng.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* Admin classification fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-primary/50 mb-1">
                      Region <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="fx Sjælland"
                      className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary/50 mb-1">
                      Kommune
                    </label>
                    <input
                      value={kommune}
                      onChange={(e) => setKommune(e.target.value)}
                      placeholder="fx Gribskov"
                      className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary/50 mb-1">
                      Sted
                    </label>
                    <input
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="fx Esrum"
                      className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Approve / Reject buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => handleApprove(sub)}
                    disabled={busy || !region.trim() || reviewLat == null}
                    className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                  >
                    {busy ? "Gemmer..." : "✅ Godkend"}
                  </button>
                  <button
                    onClick={() => setShowRejectField(true)}
                    disabled={busy}
                    className="rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    ❌ Afvis
                  </button>
                </div>

                {/* Reject reason */}
                {showRejectField && (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Angiv årsag til afvisning (sendes til ansøger)..."
                      rows={3}
                      maxLength={1000}
                      className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-y"
                    />
                    <button
                      onClick={() => handleReject(sub)}
                      disabled={busy || !rejectReason.trim()}
                      className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                      {busy ? "Afviser..." : "Send afvisning"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
