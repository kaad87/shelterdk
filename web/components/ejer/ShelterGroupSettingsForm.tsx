"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BookableShelter } from "@/types/booking";

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
}: {
  groupId: string;
  label: string;
  shelters: BookableShelter[];
}) {
  const first = shelters[0];
  const [pricePerNight, setPricePerNight] = useState<string>(
    first.shelter_price_dkk != null ? String(first.shelter_price_dkk) : ""
  );
  const [feePct, setFeePct] = useState<string>(String(first.platform_fee_pct));
  const [feeMinDkk, setFeeMinDkk] = useState<string>(String(first.platform_fee_min_dkk));
  const [paymentMode, setPaymentMode] = useState<BookableShelter["payment_mode"]>(first.payment_mode);
  const [cutoffHours, setCutoffHours] = useState<string>(String(first.cancellation_cutoff_hours));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [msgTemplates, setMsgTemplates] = useState<MsgTemplates | null>(null);
  const [msgSaving, setMsgSaving] = useState(false);
  const [msgSaved, setMsgSaved] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const confSubjRef = useRef<HTMLInputElement>(null);
  const confBodyRef = useRef<HTMLTextAreaElement>(null);
  const remSubjRef = useRef<HTMLInputElement>(null);
  const remBodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeMsgField, setActiveMsgField] = useState<MsgField | null>(null);

  useEffect(() => {
    fetch(`/api/ejer/plads/${groupId}/messages`)
      .then((r) => r.json())
      .then((data: MsgTemplates) => setMsgTemplates(data))
      .catch(() => setMsgError("Kunne ikke hente beskedskabeloner"));
  }, [groupId]);

  const saveSharedSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await fetch(`/api/ejer/plads/${groupId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shelter_price_dkk: pricePerNight === "" ? null : Number(pricePerNight),
          platform_fee_pct: Number(feePct),
          platform_fee_min_dkk: Number(feeMinDkk),
          payment_mode: paymentMode,
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
          <h2 className="font-serif text-xl font-bold text-primary">Betaling & priser</h2>
          <p className="text-sm text-primary/50 mt-1">
            Pris, gebyr og betalingsmodel deles på tværs af alle enheder på pladsen.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Pris pr. nat (kr)</label>
            <input
              type="number"
              min={0}
              value={pricePerNight}
              onChange={(e) => setPricePerNight(e.target.value)}
              className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Betalingsmodel</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as BookableShelter["payment_mode"])}
              className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            >
              <option value="after_confirmation">Betal efter accept</option>
              <option value="upfront">Betal med det samme</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Transaktionsgebyr %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={feePct}
              onChange={(e) => setFeePct(e.target.value)}
              className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Minimumsgebyr (kr)</label>
            <input
              type="number"
              min={0}
              value={feeMinDkk}
              onChange={(e) => setFeeMinDkk(e.target.value)}
              className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
        </div>

        <div className="border-t border-primary/8 pt-5">
          <h3 className="font-serif text-lg font-bold text-primary">Aflysningspolitik</h3>
          <p className="text-sm text-primary/50 mt-1">
            Gælder for alle shelters på pladsen.
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
                <Link
                  href={`/ejer/shelter/${shelter.id}/rediger`}
                  className="text-sm font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors"
                >
                  Kalender & enhed
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
