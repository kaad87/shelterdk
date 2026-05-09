"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BookableShelter } from "@/types/booking";
import type { Shelter } from "@shared/types/shelter";
import { getPetsAllowed, getToilet, getWater } from "@shared/lib/shelter-detail";

interface MsgTemplates {
  confirmation_enabled: boolean;
  confirmation_subject: string;
  confirmation_body: string;
  reminder_enabled: boolean;
  reminder_subject: string;
  reminder_body: string;
}

type MsgField = "conf_subj" | "conf_body" | "rem_subj" | "rem_body";

function previewMsg(template: string, shelterName: string): string {
  const previewCheckIn = new Date();
  previewCheckIn.setDate(previewCheckIn.getDate() + 1);
  const previewCheckOut = new Date(previewCheckIn);
  previewCheckOut.setDate(previewCheckIn.getDate() + 2);
  const fmtDa = (d: Date) =>
    d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "long" });
  return template
    .replace(/{gæst_navn}/g, "Lars")
    .replace(/{shelter_navn}/g, shelterName)
    .replace(/{ankomst_dato}/g, fmtDa(previewCheckIn))
    .replace(/{afrejse_dato}/g, fmtDa(previewCheckOut))
    .replace(/{antal_nætter}/g, "2")
    .replace(/{antal_personer}/g, "3");
}

export function ShelterGroupSettingsForm({
  groupId,
  label,
  shelters,
  sharedDescription,
  shelterData,
  basePublicPhotos,
  ownerPhotos: initialOwnerPhotos,
  photoShelterUnitId,
  shelterDbId,
}: {
  groupId: string;
  label: string;
  shelters: BookableShelter[];
  sharedDescription: string;
  shelterData: Shelter | null;
  basePublicPhotos: string[];
  ownerPhotos: string[];
  photoShelterUnitId: string;
  shelterDbId: string;
}) {
  const [description, setDescription] = useState(sharedDescription);
  const [cutoffHours, setCutoffHours] = useState<string>(String(shelters[0].cancellation_cutoff_hours));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [msgTemplates, setMsgTemplates] = useState<MsgTemplates | null>(null);
  const [msgSaving, setMsgSaving] = useState(false);
  const [msgSaved, setMsgSaved] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [ownerPhotos, setOwnerPhotos] = useState<string[]>(initialOwnerPhotos);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentMsg, setContentMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const raw = (shelterData?.geofa_raw ?? {}) as Record<string, unknown>;
  const [facilities, setFacilities] = useState({
    water: getWater(shelterData ?? ({ water: null, toilet: null, geofa_raw: null } as Shelter)) === true,
    toiletEnabled: (() => {
      const toilet = getToilet(shelterData ?? ({ water: null, toilet: null, geofa_raw: null } as Shelter));
      return toilet === "flush" || toilet === "mulch";
    })(),
    toiletType: (() => {
      const toilet = getToilet(shelterData ?? ({ water: null, toilet: null, geofa_raw: null } as Shelter));
      return toilet === "mulch" ? "mulch" : "flush";
    })() as "flush" | "mulch",
    baalplads: String(raw.baalplads ?? "").toLowerCase().includes("ja"),
    hund: getPetsAllowed(shelterData ?? ({ water: null, toilet: null, geofa_raw: null } as Shelter)) === true,
    bord_baenk: String(raw.bord_baenk ?? "").toLowerCase().includes("ja"),
    strand: String(raw.strand_naerhed ?? "").toLowerCase().includes("ja"),
    bruser: String(raw.bruser_bad ?? "").toLowerCase().includes("ja"),
    handicap: ["handicapegnet", "delvist handicapegnet"].includes(String(raw.handicap ?? "").toLowerCase()),
  });
  const [unitCapacities, setUnitCapacities] = useState<Record<string, string>>(
    Object.fromEntries(shelters.map((shelter) => [shelter.id, String(shelter.max_persons)]))
  );
  const [capacitySavingId, setCapacitySavingId] = useState<string | null>(null);
  const [capacityMsg, setCapacityMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confSubjRef = useRef<HTMLInputElement>(null);
  const confBodyRef = useRef<HTMLTextAreaElement>(null);
  const remSubjRef = useRef<HTMLInputElement>(null);
  const remBodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeMsgField, setActiveMsgField] = useState<MsgField | null>(null);
  const publicPhotos = [...basePublicPhotos, ...ownerPhotos];

  useEffect(() => {
    fetch(`/api/ejer/plads/${groupId}/messages`)
      .then((r) => r.json())
      .then((data: MsgTemplates) => setMsgTemplates(data))
      .catch(() => setMsgError("Kunne ikke hente beskedskabeloner"));
  }, [groupId]);

  const saveSharedContent = async () => {
    setContentSaving(true);
    setContentMsg(null);
    try {
      const res = await fetch(`/api/ejer/plads/${groupId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shared_description: description,
          user_image_urls: ownerPhotos,
          facilities: facilities.toiletEnabled
            ? { ...facilities, toilet: facilities.toiletType }
            : { ...facilities, toilet: "none" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContentMsg({ ok: false, text: data.error ?? "Noget gik galt" });
      } else {
        setContentMsg({ ok: true, text: "Fælles indhold gemt" });
      }
    } catch {
      setContentMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setContentSaving(false);
    }
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/ejer/shelter/${photoShelterUnitId}/billeder`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload fejlede");
        return;
      }
      setOwnerPhotos((prev) => [...prev, data.url]);
    } catch {
      setUploadError("Upload fejlede — prøv igen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!confirm("Slet dette billede?")) return;
    try {
      const res = await fetch(`/api/ejer/shelter/${photoShelterUnitId}/billeder`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error ?? "Sletning fejlede");
        return;
      }
      setOwnerPhotos((prev) => prev.filter((u) => u !== url));
    } catch {
      setUploadError("Sletning fejlede — prøv igen");
    }
  }

  function moveOwnerPhoto(url: string, direction: -1 | 1) {
    setOwnerPhotos((prev) => {
      const index = prev.indexOf(url);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  const isOwnerPhoto = (url: string) => url.includes(`/owner/${shelterDbId}/`);

  const saveSharedSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await fetch(`/api/ejer/plads/${groupId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellation_cutoff_hours: Number(cutoffHours),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSettingsMsg({ ok: false, text: data.error ?? "Noget gik galt" });
      } else {
        setSettingsMsg({ ok: true, text: `Fælles indstillinger gemt for ${shelters.length} shelters` });
      }
    } catch {
      setSettingsMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleMsgSave = async () => {
    if (!msgTemplates) return;
    setMsgSaving(true);
    setMsgError(null);
    setMsgSaved(false);
    try {
      const res = await fetch(`/api/ejer/plads/${groupId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgTemplates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgError(data.error ?? "Noget gik galt");
      } else {
        setMsgSaved(true);
        setTimeout(() => setMsgSaved(false), 3000);
      }
    } catch {
      setMsgError("Noget gik galt");
    } finally {
      setMsgSaving(false);
    }
  };

  const insertMsgPlaceholder = (placeholder: string) => {
    if (!activeMsgField || !msgTemplates) return;
    const refMap: Record<MsgField, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
      conf_subj: confSubjRef as React.RefObject<HTMLInputElement | null>,
      conf_body: confBodyRef as React.RefObject<HTMLTextAreaElement | null>,
      rem_subj: remSubjRef as React.RefObject<HTMLInputElement | null>,
      rem_body: remBodyRef as React.RefObject<HTMLTextAreaElement | null>,
    };
    const fieldMap: Record<MsgField, keyof MsgTemplates> = {
      conf_subj: "confirmation_subject",
      conf_body: "confirmation_body",
      rem_subj: "reminder_subject",
      rem_body: "reminder_body",
    };
    const el = refMap[activeMsgField].current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const field = fieldMap[activeMsgField];
    const current = String(msgTemplates[field]);
    const newValue = current.slice(0, start) + placeholder + current.slice(end);
    setMsgTemplates((prev) => (prev ? { ...prev, [field]: newValue } : null));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const saveUnitCapacity = async (shelterId: string) => {
    setCapacitySavingId(shelterId);
    setCapacityMsg(null);
    try {
      const res = await fetch(`/api/ejer/shelter/${shelterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_persons: Number(unitCapacities[shelterId]),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCapacityMsg({ ok: false, text: data.error ?? "Kunne ikke gemme kapacitet" });
      } else {
        setCapacityMsg({ ok: true, text: "Kapacitet gemt" });
      }
    } catch {
      setCapacityMsg({ ok: false, text: "Kunne ikke gemme kapacitet" });
    } finally {
      setCapacitySavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/8 bg-white shadow-sm px-6 py-5">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Fælles indstillinger</p>
        <h1 className="font-serif text-2xl font-bold text-primary leading-tight">{label}</h1>
        <p className="text-sm text-primary/50 mt-1">
          Disse indstillinger gemmes på tværs af alle {shelters.length} shelters på samme plads.
        </p>
      </div>

      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm p-6 space-y-6">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">Offentlig shelterside</h2>
          <p className="text-sm text-primary/50 mt-1">
            Beskrivelsen og billederne her deles på tværs af hele pladsens ene offentlige shelterside.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Fælles beskrivelse</label>
          <textarea
            rows={6}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
          <p className="text-xs text-primary/30 mt-1">{description.length}/2000</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-primary">Fælles billeder</h3>
              <p className="text-sm text-primary/50 mt-1">
                Disse billeder vises på den offentlige side for hele pladsen.
              </p>
            </div>
          </div>

          {publicPhotos.length > 0 ? (
            <div className="mb-6">
              <p className="text-xs font-semibold text-primary/60 uppercase tracking-wide mb-2">Nuværende offentligt galleri</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {publicPhotos.map((url) => (
                  <div key={`public-${url}`} className="relative group aspect-video rounded-xl overflow-hidden bg-primary/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                      {isOwnerPhoto(url) ? "Ejerfoto" : "Eksisterende"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-primary/40 mb-4">Ingen billeder på sheltersiden endnu.</p>
          )}

          <div className="mb-4">
            <p className="text-xs font-semibold text-primary/60 uppercase tracking-wide mb-2">Ejer-uploadede billeder</p>
            <p className="text-sm text-primary/45 mb-3">
              Du kan ændre rækkefølgen på de billeder, du selv har uploadet. De vises efter eksisterende officielle billeder på sheltersiden.
            </p>
          </div>

          {ownerPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {ownerPhotos.map((url, index) => (
                <div key={url} className="relative group aspect-video rounded-xl overflow-hidden bg-primary/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                    #{index + 1}
                  </span>
                  <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveOwnerPhoto(url, -1)}
                        disabled={index === 0}
                        className="rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Flyt tidligere"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOwnerPhoto(url, 1)}
                        disabled={index === ownerPhotos.length - 1}
                        className="rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Flyt senere"
                      >
                        →
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(url)}
                      className="rounded-md bg-red-600/90 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
                      title="Slet billede"
                    >
                      Slet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-primary/40 mb-4">Ingen ejer-uploadede billeder endnu.</p>
          )}

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary/15 rounded-xl p-6 cursor-pointer hover:border-accent/40 hover:bg-accent/[0.02] transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <span className="text-2xl mb-2">{uploading ? "⏳" : "📷"}</span>
            <span className="text-sm font-medium text-primary/60">
              {uploading ? "Uploader…" : "Klik for at tilføje billede"}
            </span>
            <span className="text-xs text-primary/30 mt-1">JPEG, PNG eller WebP · maks. 5 MB</span>
          </label>
          {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
        </div>

        <div className="rounded-xl border border-primary/8 bg-primary/[0.02] p-4 space-y-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-primary">Fælles faciliteter</h3>
            <p className="text-sm text-primary/50 mt-1">
              De her valg styrer filterchips og fakta på den fælles shelterside.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.water}
                onChange={(e) => setFacilities((prev) => ({ ...prev, water: e.target.checked }))}
              />
              Vand
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.baalplads}
                onChange={(e) => setFacilities((prev) => ({ ...prev, baalplads: e.target.checked }))}
              />
              Bålplads
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.hund}
                onChange={(e) => setFacilities((prev) => ({ ...prev, hund: e.target.checked }))}
              />
              Hund tilladt
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.bord_baenk}
                onChange={(e) => setFacilities((prev) => ({ ...prev, bord_baenk: e.target.checked }))}
              />
              Bord/bænke
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.strand}
                onChange={(e) => setFacilities((prev) => ({ ...prev, strand: e.target.checked }))}
              />
              Strand i nærheden
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.bruser}
                onChange={(e) => setFacilities((prev) => ({ ...prev, bruser: e.target.checked }))}
              />
              Bruser/bad
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={facilities.handicap}
                onChange={(e) => setFacilities((prev) => ({ ...prev, handicap: e.target.checked }))}
              />
              Handicapvenligt
            </label>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white px-4 py-4">
            <label className="flex items-center gap-3 text-sm font-medium text-primary">
              <input
                type="checkbox"
                checked={facilities.toiletEnabled}
                onChange={(e) => setFacilities((prev) => ({ ...prev, toiletEnabled: e.target.checked }))}
              />
              Toilet på pladsen
            </label>
            {facilities.toiletEnabled && (
              <div className="mt-3 max-w-xs">
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                  Toilettype
                </label>
                <select
                  value={facilities.toiletType}
                  onChange={(e) =>
                    setFacilities((prev) => ({
                      ...prev,
                      toiletType: e.target.value === "mulch" ? "mulch" : "flush",
                    }))
                  }
                  className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                >
                  <option value="flush">Vandskyllende toilet</option>
                  <option value="mulch">Muldtoilet</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveSharedContent}
            disabled={contentSaving}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
          >
            {contentSaving ? "Gemmer…" : "Gem fælles indhold"}
          </button>
          {contentMsg && (
            <p className={`text-sm ${contentMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{contentMsg.text}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm p-6 space-y-5">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">Shelter-enheder</h2>
          <p className="text-sm text-primary/50 mt-1">
            Her kan du justere kapaciteten for hver enkelt enhed. Bookinger og kalendere styres stadig separat pr. shelter.
          </p>
        </div>

        <div className="space-y-3">
          {shelters.map((shelter) => (
            <div
              key={shelter.id}
              className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-primary">{shelter.title}</h3>
                <p className="text-xs text-primary/45 mt-0.5">Kapacitet og kalender er unikke for denne enhed.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div>
                  <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                    Maks. personer
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={unitCapacities[shelter.id] ?? String(shelter.max_persons)}
                    onChange={(e) =>
                      setUnitCapacities((prev) => ({ ...prev, [shelter.id]: e.target.value }))
                    }
                    className="w-32 rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => saveUnitCapacity(shelter.id)}
                    disabled={capacitySavingId === shelter.id}
                    className="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors"
                  >
                    {capacitySavingId === shelter.id ? "Gemmer…" : "Gem kapacitet"}
                  </button>
                  <Link
                    href={`/ejer/shelter/${shelter.id}/bookinger`}
                    className="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                  >
                    Bookinger
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        {capacityMsg && (
          <p className={`text-sm ${capacityMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{capacityMsg.text}</p>
        )}
      </section>

      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm p-6 space-y-6">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">Aflysningspolitik</h2>
          <p className="text-sm text-primary/50 mt-1">
            Gælder for alle shelters på pladsen. Pris, gebyr og betalingsopsætning styres af ShelterDK i admin.
          </p>
          <div className="mt-4 max-w-xs">
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Frist (timer)</label>
            <input
              type="number"
              min={0}
              value={cutoffHours}
              onChange={(e) => setCutoffHours(e.target.value)}
              className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveSharedSettings}
            disabled={settingsSaving}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
          >
            {settingsSaving ? "Gemmer…" : "Gem fælles indstillinger"}
          </button>
          {settingsMsg && (
            <p className={`text-sm ${settingsMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{settingsMsg.text}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm p-6 space-y-5">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">Automatiske beskeder</h2>
          <p className="text-sm text-primary/50 mt-1">
            De samme email-skabeloner gemmes på tværs af alle {shelters.length} shelters i gruppen.
          </p>
        </div>

        {msgTemplates ? (
          <>
            <div className="flex flex-wrap gap-2">
              {["{gæst_navn}", "{shelter_navn}", "{ankomst_dato}", "{afrejse_dato}", "{antal_nætter}", "{antal_personer}"].map((placeholder) => (
                <button
                  key={placeholder}
                  type="button"
                  onClick={() => insertMsgPlaceholder(placeholder)}
                  className="rounded-full border border-primary/15 px-3 py-1.5 text-sm text-primary/70 hover:bg-primary/5"
                >
                  {placeholder}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-primary/8 p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Bekræftelsesbesked</h3>
                  <p className="text-sm text-primary/45">Sendes når en booking bliver bekræftet.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-primary/60">
                  <input
                    type="checkbox"
                    checked={msgTemplates.confirmation_enabled}
                    onChange={(e) => setMsgTemplates((prev) => prev ? { ...prev, confirmation_enabled: e.target.checked } : null)}
                  />
                  Til
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Emne</label>
                <input
                  ref={confSubjRef}
                  value={msgTemplates.confirmation_subject}
                  onFocus={() => setActiveMsgField("conf_subj")}
                  onChange={(e) => setMsgTemplates((prev) => prev ? { ...prev, confirmation_subject: e.target.value } : null)}
                  className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Besked</label>
                <textarea
                  ref={confBodyRef}
                  rows={7}
                  value={msgTemplates.confirmation_body}
                  onFocus={() => setActiveMsgField("conf_body")}
                  onChange={(e) => setMsgTemplates((prev) => prev ? { ...prev, confirmation_body: e.target.value } : null)}
                  className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </div>
              <div className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3">
                <p className="text-xs font-semibold text-primary/40 uppercase tracking-wide mb-2">Preview</p>
                <pre className="whitespace-pre-wrap text-sm text-primary/70 font-sans">
                  {previewMsg(`${msgTemplates.confirmation_subject}\n\n${msgTemplates.confirmation_body}`, shelters[0].title)}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/8 p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Påmindelsesbesked</h3>
                  <p className="text-sm text-primary/45">Sendes dagen før gæstens ankomst.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-primary/60">
                  <input
                    type="checkbox"
                    checked={msgTemplates.reminder_enabled}
                    onChange={(e) => setMsgTemplates((prev) => prev ? { ...prev, reminder_enabled: e.target.checked } : null)}
                  />
                  Til
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Emne</label>
                <input
                  ref={remSubjRef}
                  value={msgTemplates.reminder_subject}
                  onFocus={() => setActiveMsgField("rem_subj")}
                  onChange={(e) => setMsgTemplates((prev) => prev ? { ...prev, reminder_subject: e.target.value } : null)}
                  className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Besked</label>
                <textarea
                  ref={remBodyRef}
                  rows={5}
                  value={msgTemplates.reminder_body}
                  onFocus={() => setActiveMsgField("rem_body")}
                  onChange={(e) => setMsgTemplates((prev) => prev ? { ...prev, reminder_body: e.target.value } : null)}
                  className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </div>
              <div className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3">
                <p className="text-xs font-semibold text-primary/40 uppercase tracking-wide mb-2">Preview</p>
                <pre className="whitespace-pre-wrap text-sm text-primary/70 font-sans">
                  {previewMsg(`${msgTemplates.reminder_subject}\n\n${msgTemplates.reminder_body}`, shelters[0].title)}
                </pre>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleMsgSave}
                disabled={msgSaving}
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
              >
                {msgSaving ? "Gemmer…" : "Gem beskeder"}
              </button>
              {msgSaved && <p className="text-sm text-emerald-700">Beskeder gemt på tværs af gruppen</p>}
              {msgError && <p className="text-sm text-red-600">{msgError}</p>}
            </div>
          </>
        ) : (
          <p className="text-sm text-primary/50">Henter beskedskabeloner…</p>
        )}
      </section>

      <section className="rounded-2xl border border-primary/8 bg-white shadow-sm p-6">
        <h2 className="font-serif text-xl font-bold text-primary">Kalendere og bookinger pr. shelter</h2>
        <p className="text-sm text-primary/50 mt-1 mb-4">
          Kalenderintegration, blokeringer og konkrete bookinger styres stadig separat for hver enhed.
        </p>
        <div className="space-y-2">
          {shelters.map((shelter) => (
            <div
              key={shelter.id}
              className="rounded-xl border border-primary/8 bg-primary/[0.02] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="text-sm font-semibold text-primary">{shelter.title}</h3>
                <p className="text-xs text-primary/45 mt-0.5">Kalendere, blokeringer og manuelle bookinger er unikke for denne enhed.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/ejer/shelter/${shelter.id}/bookinger`}
                  className="text-sm font-medium text-primary border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                >
                  Bookinger
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
