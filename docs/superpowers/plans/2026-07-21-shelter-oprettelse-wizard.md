# Shelter-oprettelse: fix billed-upload + wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Få ejeres selvbetjente shelter-oprettelse (inkl. billed-upload) til at virke helt, og samle to overlappende formularer til ét trin-for-trin wizard-flow.

**Architecture:** Den eksisterende backend (submit-API, foto-upload-API, approve-flow, `shelter_submissions`-tabel) er korrekt og bevares uændret — den eneste backend-fejl er en manglende storage-bucket. Frontend: den rige `ShelterSubmissionForm` (635 l) opdeles i en wizard-shell + fokuserede trin-komponenter og en foto-upload-hook. Den simple `RegistrerShelterForm` udfases; `/registrer-shelter` bliver kanonisk og renderer wizard'en.

**Tech Stack:** Next.js 14 App Router, React client components, Supabase Storage (`createAdminClient`), Vitest + React Testing Library, Tailwind (brand-tokens `pine`/`accent`/`sand`).

**Referencedokument (spec):** `docs/superpowers/specs/2026-07-21-shelter-oprettelse-fix-og-wizard-design.md`

**Verifikationsregel (projekt):** Kør altid `cd web && npx tsc --noEmit && npx next lint` før commit — Netlify bygger med lint, og en lint-*fejl* vælter deploy. @feedback_verify_with_next_build

---

## Filstruktur (mål)

**Ny mappe:** `web/components/shelter-wizard/`
- `ShelterWizard.tsx` — shell: samlet felt-state, trin-index, fremgangslinje, Næste/Tilbage, per-trin-validering, endelig submit, success-skærm. (Erstatter `ShelterSubmissionForm.tsx`.)
- `usePhotoUpload.ts` — hook: upload/fjern/progress/fejl-state for billeder (den mest testbare og fejlfølsomme logik).
- `steps/StepAbout.tsx` — navn, placering (fritekst), kapacitet, beskrivelse, booking-URL.
- `steps/StepMap.tsx` — kort-markør (lat/lng). Genbruger eksisterende kort-kode fra `ShelterSubmissionForm`.
- `steps/StepFacilities.tsx` — facilitets-checkboxes.
- `steps/StepPhotos.tsx` — stor drop-zone + thumbnail-stribe.
- `steps/StepBooking.tsx` — booking-opt-in.
- `steps/StepReview.tsx` — opsummering + kontakt (navn/email) + honeypot + send.

**Ændres:**
- `web/app/(site)/registrer-shelter/page.tsx` — renderer `<ShelterWizard />` i stedet for `<RegistrerShelterForm />`.
- `web/next.config.js` — tilføj 301-redirect `/opret-shelter` → `/registrer-shelter`.
- `web/app/api/admin/approve-shelter-submission/route.ts` — tilføj revalidering af ny shelter-side + region efter insert.

**Slettes (død kode efter flytning):**
- `web/app/(site)/registrer-shelter/RegistrerShelterForm.tsx`
- `web/app/(site)/opret-shelter/page.tsx` (og mappen)
- `web/components/ShelterSubmissionForm.tsx`

**Nye tests:** `web/components/shelter-wizard/__tests__/` (wizard-navigation, validering, foto-hook).

---

## Task 1: Opret den manglende storage-bucket (fixer bug'en)

Rod-årsagen til at 0 indsendelser nogensinde har haft billeder: bucketen `shelter-submissions` (som upload-API og approve-flow begge peger på) eksisterer ikke.

**Files:**
- Create: `web/supabase/migrations/20260721_shelter_submissions_bucket.sql`

- [ ] **Step 1: Skriv migrationen**

```sql
-- Privat bucket til shelter-indsendelsers billeder (pending/). Kun service_role
-- rører den: uploads sker via createAdminClient(), previews via signed URLs,
-- og approve-flowet kopierer herfra til den offentlige 'shelter-photos'.
-- Ingen RLS-policies nødvendige (service_role omgår RLS) og ingen anon-adgang.
insert into storage.buckets (id, name, public)
values ('shelter-submissions', 'shelter-submissions', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Anvend migrationen mod remote**

Brug Supabase MCP `apply_migration` (project_id `winiuqqbllntgjeowkbs`, name `shelter_submissions_bucket`) med SQL'en ovenfor.

- [ ] **Step 3: Verificér at bucketen findes**

Via MCP `execute_sql`:
```sql
select id, public from storage.buckets where id = 'shelter-submissions';
```
Expected: én række, `public = false`.

- [ ] **Step 4: Ende-til-ende røgtest af upload (før wizard-ombygning)**

Start preview (`registrer-shelter`), upload ét billede i den nuværende formular, og bekræft via MCP:
```sql
select photo_urls from shelter_submissions order by created_at desc limit 1;
```
Expected: `photo_urls` indeholder en `pending/<uuid>.<ext>`-sti (ikke tom). Bekræfter at pipelinen nu virker end-to-end.

- [ ] **Step 5: Commit**

```bash
git add web/supabase/migrations/20260721_shelter_submissions_bucket.sql
git commit -m "fix(submissions): opret manglende shelter-submissions storage-bucket

Upload-API og approve-flow pegede på en bucket der ikke fandtes → hver
foto-upload fejlede 500, og 0 indsendelser fik nogensinde billeder."
```

---

## Task 2: Rutesammenlægning (redirect + swap + slet død form)

Begge formularer sender `type: owner_registration`. Behold `/registrer-shelter` som kanonisk, redirect `/opret-shelter` dertil, og udfas den simple form.

**Files:**
- Modify: `web/next.config.js` (redirects-array, ~linje 101)
- Modify: `web/app/(site)/registrer-shelter/page.tsx`
- Delete: `web/app/(site)/registrer-shelter/RegistrerShelterForm.tsx`, `web/app/(site)/opret-shelter/page.tsx`

> Udføres FØR wizard'en er bygget bør undgås — `/registrer-shelter` skal pege på en fungerende komponent hele tiden. Derfor: i denne task peger `page.tsx` midlertidigt fortsat på den eksisterende `ShelterSubmissionForm` (den rige form, som allerede virker), og redirect'en tilføjes. Den endelige omdøbning til `ShelterWizard` sker i Task 7.

- [ ] **Step 1: Tilføj redirect i next.config.js**

I `redirects()`-arrayet:
```js
{ source: "/opret-shelter", destination: "/registrer-shelter", permanent: true },
```

- [ ] **Step 2: Peg /registrer-shelter på den rige form (midlertidigt)**

I `web/app/(site)/registrer-shelter/page.tsx`: erstat import + brug af `RegistrerShelterForm` med `ShelterSubmissionForm` fra `@/components/ShelterSubmissionForm`. Behold sidens øvrige tekst/metadata.

- [ ] **Step 3: Slet den simple form + opret-shelter-siden**

```bash
git rm web/app/(site)/registrer-shelter/RegistrerShelterForm.tsx
git rm web/app/(site)/opret-shelter/page.tsx
```
Bekræft ingen dangling imports:
```bash
grep -rn "RegistrerShelterForm\|opret-shelter" web/app web/components --include="*.tsx" | grep -v "redirect"
```
Expected: ingen kode-referencer tilbage.

- [ ] **Step 4: Verificér**

```bash
cd web && npx tsc --noEmit && npx next lint --file "app/(site)/registrer-shelter/page.tsx"
```
Expected: ingen fejl. Start preview, bekræft `/registrer-shelter` viser den rige form (med kort + billeder), og at `/opret-shelter` 301-redirecter.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(submissions): saml oprettelse på /registrer-shelter, redirect /opret-shelter"
```

---

## Task 3: Foto-upload-hook (`usePhotoUpload`)

Isolér den fejlfølsomme upload-logik i en testbar hook, inkl. tydelig fejl-state og upload-progress (spec Del 3). Genbruger den eksisterende fetch-logik fra `ShelterSubmissionForm` (linje ~150-200).

**Files:**
- Create: `web/components/shelter-wizard/usePhotoUpload.ts`
- Test: `web/components/shelter-wizard/__tests__/usePhotoUpload.test.ts`

- [ ] **Step 1: Skriv den fejlende test**

```ts
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePhotoUpload } from "../usePhotoUpload";

function mockFile(name = "a.jpg", type = "image/jpeg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe("usePhotoUpload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tilføjer et billede ved succesfuld upload", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ path: "pending/x.jpg", previewUrl: "blob:1", deleteToken: "t" }), { status: 200 })
    );
    const { result } = renderHook(() => usePhotoUpload("hp"));
    await act(async () => { await result.current.addPhoto(mockFile()); });
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.photos[0].path).toBe("pending/x.jpg");
    expect(result.current.error).toBeNull();
  });

  it("sætter synlig fejl når upload fejler", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Upload fejlede — prøv igen" }), { status: 500 })
    );
    const { result } = renderHook(() => usePhotoUpload("hp"));
    await act(async () => { await result.current.addPhoto(mockFile()); });
    expect(result.current.photos).toHaveLength(0);
    expect(result.current.error).toBe("Upload fejlede — prøv igen");
  });

  it("afviser mere end 5 billeder", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ path: "pending/x.jpg", previewUrl: null, deleteToken: "t" }), { status: 200 })
    );
    const { result } = renderHook(() => usePhotoUpload("hp"));
    for (let i = 0; i < 5; i++) {
      await act(async () => { await result.current.addPhoto(mockFile()); });
    }
    await act(async () => { await result.current.addPhoto(mockFile()); });
    expect(result.current.photos).toHaveLength(5);
    expect(result.current.error).toMatch(/maks 5/i);
  });
});
```

- [ ] **Step 2: Kør testen — forvent FAIL**

Run: `cd web && npx vitest run components/shelter-wizard/__tests__/usePhotoUpload.test.ts`
Expected: FAIL ("Cannot find module '../usePhotoUpload'").

- [ ] **Step 3: Implementér hook'en**

```ts
import { useState, useCallback } from "react";

export interface UploadedPhoto {
  path: string;
  previewUrl: string | null;
  deleteToken: string;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export function usePhotoUpload(honeypot: string) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = useCallback(async (file: File) => {
    setError(null);
    if (photos.length >= 5) { setError("Maks 5 billeder"); return; }
    if (!ALLOWED.includes(file.type)) { setError("Brug et billede i JPEG, PNG eller WebP"); return; }
    if (file.size > MAX_BYTES) { setError("Billedet er for stort (maks 10 MB)"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("website", honeypot);
      const res = await fetch("/api/submit-shelter/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload fejlede — prøv igen"); return; }
      setPhotos((prev) => [...prev, { path: data.path, previewUrl: data.previewUrl, deleteToken: data.deleteToken }]);
    } catch {
      setError("Upload fejlede — prøv igen");
    } finally {
      setUploading(false);
    }
  }, [photos.length, honeypot]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const photo = prev[index];
      if (photo) {
        fetch("/api/submit-shelter/photos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: photo.path, deleteToken: photo.deleteToken }),
        }).catch((err) => console.error("Photo delete failed:", err));
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return { photos, uploading, error, addPhoto, removePhoto };
}
```

- [ ] **Step 4: Kør testen — forvent PASS**

Run: `cd web && npx vitest run components/shelter-wizard/__tests__/usePhotoUpload.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add web/components/shelter-wizard/usePhotoUpload.ts web/components/shelter-wizard/__tests__/usePhotoUpload.test.ts
git commit -m "feat(wizard): usePhotoUpload-hook med synlig fejl-state"
```

---

## Task 4: Wizard-shell med trin-navigation + validering

Shell'en holder al felt-state, viser fremgangslinje, ét trin ad gangen, og gater "Næste" på per-trin-validering. Bygges først med simple trin-placeholders; de rige trin fyldes i Task 5-6.

**Files:**
- Create: `web/components/shelter-wizard/ShelterWizard.tsx`
- Test: `web/components/shelter-wizard/__tests__/ShelterWizard.test.tsx`

- [ ] **Step 1: Skriv den fejlende test (navigation + validerings-gate)**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ShelterWizard } from "../ShelterWizard";

// NB: I denne task bruger shell'en inline placeholder-trin (ingen StepMap-import
// endnu), så INGEN vi.mock her. Når StepMap wires ind i Task 5, tilføjes
// `vi.mock("../steps/StepMap", () => ({ StepMap: () => <div data-testid="step-map" /> }))`
// øverst i denne fil (leaflet er tung og virker ikke i jsdom).

describe("ShelterWizard", () => {
  it("blokerer Næste på trin 1 indtil navn + placering er udfyldt", () => {
    render(<ShelterWizard />);
    fireEvent.click(screen.getByRole("button", { name: /næste/i }));
    // Stadig på trin 1 (fejl vist, ikke avanceret til kort-trinnet)
    expect(screen.getByText(/trin 1 af 6/i)).toBeInTheDocument();
    expect(screen.getByText(/navn er påkrævet/i)).toBeInTheDocument();
  });

  it("avancerer til trin 2 når trin 1 er gyldigt", () => {
    render(<ShelterWizard />);
    fireEvent.change(screen.getByLabelText(/navn/i), { target: { value: "Skovhytten" } });
    fireEvent.change(screen.getByLabelText(/placering/i), { target: { value: "Gribskov" } });
    fireEvent.click(screen.getByRole("button", { name: /næste/i }));
    expect(screen.getByText(/trin 2 af 6/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Kør testen — forvent FAIL**

Run: `cd web && npx vitest run components/shelter-wizard/__tests__/ShelterWizard.test.tsx`
Expected: FAIL (modul findes ikke).

- [ ] **Step 3: Implementér shell'en**

Byg `ShelterWizard.tsx` (`"use client"`) med:
- Al felt-state flyttet fra `ShelterSubmissionForm` (shelterName, locationText, capacity, description, bookingUrl, lat, lng, facilities, wantsBooking, bookingAccepted, contactName, contactEmail, website/honeypot) + `usePhotoUpload`.
- `const [step, setStep] = useState(0)` over 6 trin.
- `STEP_TITLES = ["Om shelteret","Placering","Faciliteter","Billeder","Booking","Gennemse & send"]`.
- `validateStep(step): string | null` — trin 0: navn + placering påkrævet; trin 4: hvis `wantsBooking` så `bookingAccepted`; trin 5: email påkrævet + booking-URL-format. Øvrige trin: ingen krav (kort/faciliteter/billeder valgfri).
- `next()` kalder `validateStep`; ved fejl vis besked og bliv; ellers `setStep(s+1)`.
- Fremgangslinje (genbrug mønster fra mockup: done/on/upcoming-dots).
- Trin 5 (Gennemse) submitter via den eksisterende `handleSubmit`-payload (uændret felt-mapping, `photo_urls: photos.map(p => p.path)`).
- Success-skærm (flyttet fra `ShelterSubmissionForm`, evt. tonet til brand-farver).
- Trin-indhold: render `StepAbout`/`StepMap`/... (oprettes i Task 5-6); i denne task må trinnene være minimale inputs nok til at testen passerer (navn + placering-felter med korrekte labels).

- [ ] **Step 4: Kør testen — forvent PASS**

Run: `cd web && npx vitest run components/shelter-wizard/__tests__/ShelterWizard.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add web/components/shelter-wizard/ShelterWizard.tsx web/components/shelter-wizard/__tests__/ShelterWizard.test.tsx
git commit -m "feat(wizard): shell med trin-navigation og per-trin-validering"
```

---

## Task 5: Trin-komponenter (Om, Kort, Faciliteter, Booking, Gennemse)

Flyt den eksisterende trin-UI fra `ShelterSubmissionForm` ind i fokuserede komponenter. Ren refaktorering af eksisterende, fungerende markup — ingen ny logik.

**Files:**
- Create: `web/components/shelter-wizard/steps/StepAbout.tsx`, `StepMap.tsx`, `StepFacilities.tsx`, `StepBooking.tsx`, `StepReview.tsx`

- [ ] **Step 1: Definér en fælles props-kontrakt**

Hvert trin får kun de felter+settere det bruger (ikke hele state-bagagen), fx:
```ts
interface StepAboutProps {
  shelterName: string; setShelterName: (v: string) => void;
  locationText: string; setLocationText: (v: string) => void;
  capacity: string; setCapacity: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  bookingUrl: string; setBookingUrl: (v: string) => void;
  error: string | null;
}
```

- [ ] **Step 2: Flyt markup fra ShelterSubmissionForm ind i hvert trin**

Kopiér de eksisterende sektioner (Section 1-3, 5 + kontakt) fra `ShelterSubmissionForm.tsx` til de tilsvarende trin-komponenter. `StepMap` genbruger den eksisterende leaflet/kort-kode (LayersControl m.m.). `StepReview` viser en kort opsummering + kontakt-felter + honeypot-input.

- [ ] **Step 3: Wire trinnene ind i shell'en**

Erstat placeholder-trin i `ShelterWizard.tsx` med de rigtige komponenter, koblet til shell-state.

- [ ] **Step 4: Verificér**

Run: `cd web && npx tsc --noEmit && npx vitest run components/shelter-wizard && npx next lint --dir components/shelter-wizard`
Expected: tests grønne, ingen type-/lint-fejl.

- [ ] **Step 5: Commit**

```bash
git add web/components/shelter-wizard/steps
git add web/components/shelter-wizard/ShelterWizard.tsx
git commit -m "feat(wizard): trin-komponenter (om, kort, faciliteter, booking, gennemse)"
```

---

## Task 6: Billed-trin — stor drop-zone + thumbnail-stribe

Det valgte UX (spec Del 3): stor træk-og-slip-zone, miniatur-stribe med ×-fjern, hovedbillede-markering (første = hoved), upload-progress, og tydelig fejl.

**Files:**
- Create: `web/components/shelter-wizard/steps/StepPhotos.tsx`
- Test: `web/components/shelter-wizard/__tests__/StepPhotos.test.tsx`

- [ ] **Step 1: Skriv den fejlende test**

```tsx
import { render, screen } from "@testing-library/react";
import { StepPhotos } from "../steps/StepPhotos";

const photo = { path: "pending/x.jpg", previewUrl: "blob:1", deleteToken: "t" };

it("viser hovedbillede-badge på første billede", () => {
  render(<StepPhotos photos={[photo, { ...photo, path: "pending/y.jpg" }]} uploading={false} error={null} onAdd={() => {}} onRemove={() => {}} />);
  expect(screen.getByText(/hoved/i)).toBeInTheDocument();
});

it("viser fejlbesked når error er sat", () => {
  render(<StepPhotos photos={[]} uploading={false} error={"Upload fejlede — prøv igen"} onAdd={() => {}} onRemove={() => {}} />);
  expect(screen.getByText(/upload fejlede/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Kør testen — forvent FAIL**

Run: `cd web && npx vitest run components/shelter-wizard/__tests__/StepPhotos.test.tsx`
Expected: FAIL (modul findes ikke).

- [ ] **Step 3: Implementér StepPhotos**

- Drop-zone: `<div>` med `onDragOver`/`onDrop` (kald `onAdd(file)` pr. droppet fil) + skjult `<input type="file" accept="image/*" multiple>` udløst af klik ("vælg filer").
- Vejledningstekst: "JPG/PNG/WebP · maks 5 · op til 10 MB" + "Første billede bliver hovedbillede".
- Thumbnail-stribe: for hvert billede vis `previewUrl` (eller neutral placeholder hvis null), ×-knap (`onRemove(i)`), og "Hoved"-badge på `i === 0`.
- Når `uploading`: vis progress/spinner-indikator i striben.
- Når `error`: rød fejlboks (brand: `bg-red-50 text-red-700 border-red-200`).
- Alt tekst dansk, brand-toner (`pine`/`accent`).

- [ ] **Step 4: Kør testen — forvent PASS**

Run: `cd web && npx vitest run components/shelter-wizard/__tests__/StepPhotos.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Wire ind i shell + commit**

Kobl `StepPhotos` til `usePhotoUpload`-værdierne i `ShelterWizard`. Derefter:
```bash
git add web/components/shelter-wizard/steps/StepPhotos.tsx web/components/shelter-wizard/__tests__/StepPhotos.test.tsx web/components/shelter-wizard/ShelterWizard.tsx
git commit -m "feat(wizard): billed-trin med drop-zone, hovedbillede og synlig fejl"
```

---

## Task 7: Endelig omdøbning + slet gammel form + approve-revalidering

**Files:**
- Modify: `web/app/(site)/registrer-shelter/page.tsx` (peg på `ShelterWizard`)
- Delete: `web/components/ShelterSubmissionForm.tsx`
- Modify: `web/app/api/admin/approve-shelter-submission/route.ts`

- [ ] **Step 1: Peg siden på wizard'en**

I `registrer-shelter/page.tsx`: importer `ShelterWizard` fra `@/components/shelter-wizard/ShelterWizard` og render den i stedet for `ShelterSubmissionForm`.

- [ ] **Step 2: Slet den gamle monolit-form**

```bash
git rm web/components/ShelterSubmissionForm.tsx
grep -rn "ShelterSubmissionForm" web/app web/components --include="*.tsx"
```
Expected: ingen referencer tilbage.

- [ ] **Step 3: Tilføj revalidering ved approve**

I `approve-shelter-submission/route.ts`, efter succesfuld `insert` i `shelters`: importer `revalidatePath` og revalidér den nye shelter-sti samt regionen (så et godkendt shelter er synligt straks). Følg eksisterende slug/region-felter i insert-payloaden.

- [ ] **Step 4: Verificér (fuld)**

```bash
cd web && npx tsc --noEmit && npx vitest run components/shelter-wizard && npx next lint
```
Expected: alt grønt.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(wizard): registrer-shelter renderer ShelterWizard; slet gammel form; revalidér ved approve"
```

---

## Task 8: Ende-til-ende-verifikation i preview

**Files:** ingen (verifikation).

- [ ] **Step 1: Kør fuld flow i preview**

Start dev-server. Gennemgå wizard'en trin-for-trin på `/registrer-shelter`: udfyld om→kort→faciliteter→**upload 2 billeder**→booking→gennemse→send. Bekræft success-skærm.

- [ ] **Step 2: Bekræft data + billeder i DB**

Via MCP `execute_sql`:
```sql
select shelter_name, status, array_length(photo_urls,1) as billeder, wants_booking
from shelter_submissions order by created_at desc limit 1;
```
Expected: `billeder = 2`, `status = pending`.

- [ ] **Step 3: Godkend i admin og bekræft live**

Log ind i `/admin/shelter-ansogninger`, godkend indsendelsen. Bekræft:
```sql
select slug, image_url, array_length(image_urls,1) as billeder from shelters order by created_at desc limit 1;
```
Expected: shelter oprettet med `image_url` sat. Åbn shelter-siden i preview og bekræft billedet vises.

- [ ] **Step 4: Responsiv-tjek**

Resize til mobil (375px): bekræft at wizard-trin, drop-zone og fremgangslinje ser rigtige ud.

- [ ] **Step 5: Ryd op i testdata**

Slet test-indsendelsen/-shelteret via MCP hvis det ikke skal bevares (undgå at forurene produktionsdata).

---

## Uden for scope (bevidst)

- De 7 ventende indsendelser i backloggen (separat opgave).
- `user_tip`-flowet (kun ejer-registrering her).
- Supabase compute-opgradering (separat driftsbeslutning).
