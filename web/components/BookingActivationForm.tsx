"use client";

import { useState } from "react";

const VILKAR = [
  {
    label: "Gratis for dig som ejer.",
    text: "Ingen oprettelsespris, abonnement eller skjulte omkostninger.",
  },
  {
    label: "Ingen lejeopkrævning.",
    text: "Du stiller dit shelter gratis til rådighed og opkræver ingen leje.",
  },
  {
    label: "Automatisk administration.",
    text: "ShelterDK håndterer al betaling og kommunikation med gæsten.",
  },
  {
    label: "Afmelding.",
    text: "Begge parter kan til enhver tid opsige med 1 måneds varsel.",
  },
  {
    label: "Servicegebyr.",
    text: "For at dække drift og administration opkræves et servicegebyr på 20 kr. inkl. moms pr. gennemført booking direkte af gæsten. Du er ikke involveret i betalingstransaktionen.",
  },
  {
    label: "Aflysninger.",
    text: "Gæsten kan aflyse gratis op til 24 timer før. Aflyser du, refunderes gæsten altid fuldt ud.",
  },
  {
    label: "GDPR.",
    text: "Gæstens bookingdata (navn, kontaktinfo) deles med dig udelukkende til administration af overnatningerne.",
  },
];

export function BookingActivationForm() {
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [shelterName, setShelterName] = useState("");
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-3xl mb-3">✅</div>
        <h2 className="text-xl font-semibold text-green-800 mb-2">
          Tak for din tilmelding!
        </h2>
        <p className="text-green-700 text-sm">
          Vi gennemgår din forespørgsel og vender tilbage til dig på{" "}
          <strong>{email}</strong> inden for 2 hverdage.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError("Du skal acceptere samarbejdsvilkårene");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/activate-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          organisation: organisation.trim(),
          email: email.trim(),
          shelterName: shelterName.trim(),
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Noget gik galt — prøv igen");
        return;
      }
      setDone(true);
    } catch {
      setError("Netværksfejl — tjek din forbindelse og prøv igen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-primary/10 rounded-2xl p-8 space-y-5 bg-white shadow-sm"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary/80 mb-1.5">
            Dit navn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="Christian Kaad"
            className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/80 mb-1.5">
            Organisation <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            required
            maxLength={200}
            placeholder="Geopark Odsherred"
            className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary/80 mb-1.5">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="du@organisation.dk"
          className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary/80 mb-1.5">
          Shelterets navn på ShelterDK <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={shelterName}
          onChange={(e) => setShelterName(e.target.value)}
          required
          maxLength={200}
          placeholder="fx Skovhytten ved Esrum Sø"
          className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary/80 mb-1.5">
          Evt. besked
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Særlige ønsker eller spørgsmål?"
          className="w-full rounded-lg border border-primary/20 px-3 py-2.5 text-sm focus:outline-none focus:border-accent bg-background resize-none"
        />
      </div>

      {/* Vilkår */}
      <div className="bg-background rounded-xl p-4 border border-primary/8">
        <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider mb-3">
          Samarbejdsvilkår
        </p>
        <div className="text-xs text-primary/50 leading-relaxed space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {VILKAR.map((v) => (
            <p key={v.label}>
              <strong className="text-primary/70">{v.label}</strong> {v.text}
            </p>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 rounded border-primary/20 accent-[#C5A059]"
        />
        <span className="text-sm text-primary/70">
          Jeg accepterer{" "}
          <span className="underline text-primary font-medium">
            samarbejdsvilkårene
          </span>{" "}
          og bekræfter at oplysningerne er korrekte.
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-accent text-white py-3 font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50 shadow"
      >
        {submitting
          ? "Sender..."
          : "Send tilmelding — vi kontakter dig inden 2 hverdage"}
      </button>
      <p className="text-center text-xs text-primary/30">
        Ingen kreditkort. Ingen binding. Gratis at bruge.
      </p>
      <p className="text-center text-xs text-primary/40">
        Spørgsmål?{" "}
        <a
          href="mailto:hej@shelterdk.dk"
          className="underline hover:text-primary/60"
        >
          hej@shelterdk.dk
        </a>
      </p>
    </form>
  );
}
