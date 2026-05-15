# Booking Trust Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tilføj CVR-nummer og platformsforklaring to steder i booking-rejsen så brugere ikke oplever betalingssiden som scamagtig.

**Architecture:** To uafhængige UI-ændringer — ingen nye filer, ingen API-kald, ingen DB-ændringer. Ændring 1 tilføjer en kompakt trust-note på shelter-detaljesiden (kun ShelterDK-bookings). Ændring 2 erstatter de nuværende trust-bullets i booking-formularen (kun upfront-mode) med en "Om ShelterDK"-boks med CVR og badges.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Vitest

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `components/ShelterDetailContent.tsx` | Tilføj trust-note i BookingCard for ShelterDK-units |
| `components/booking/BookingForm.tsx` | Erstat upfront trust-bullets med "Om ShelterDK"-blok |

---

## Vigtig kontekst: Hvornår er det ShelterDK-booking?

I `ShelterDetailContent.tsx` er der to separate props:
- `bookingUnits` — array af ShelterDK-shelters (fra `bookable_shelters`-tabellen). Disse linker til `/book/[slug]` på ShelterDK selv.
- `bookingUrl` — ekstern URL (Naturstyrelsen, andet system). Er en separat branch.

`bookingUnits` indeholder KUN ShelterDK-bookings. Tjekket på `bookingUnits.length === 1` eller `hasMultipleBookingUnits` er derfor tilstrækkeligt til at identificere ShelterDK-mode — ingen yderligere betingelse er nødvendig.

---

## Task 1: Trust-note på shelter-detaljesiden

**Fil:** `components/ShelterDetailContent.tsx`

### Struktur i filen (linje 133–176)

`BookingCard`-komponenten (linje 133) har denne ternary-struktur:
```
hasMultipleBookingUnits ?   (linje 135–164)  → liste af ShelterDK-shelters
bookingUnits.length === 1 ? (linje 165–176)  → enkelt ShelterDK-shelter
bookingUrl ?                (linje 177–190)  → ekstern link
isBookable ?                (linje 191–218)  → fallback
```

Trust-noten indsættes i de to første branches. Den eksterne branch røres ikke.

- [ ] **Step 1: Tilføj CVR-konstant**

Find linjen `"use client";` øverst i `components/ShelterDetailContent.tsx`. Tilføj konstanten efter alle imports, på en ny linje før komponenten:

```tsx
const SHELTER_DK_CVR = "44 37 89 65";
```

- [ ] **Step 2: Erstat den eksisterende `<p>`-tekst i enkelt-unit-branchen (linje 173–175)**

Find præcist denne kode (linje 173–175):
```tsx
          <p className="text-center text-primary/70 text-sm mt-3">
            Booking håndteres direkte på ShelterDK
          </p>
```

Erstat med trust-noten:
```tsx
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/8 bg-primary/[0.03] px-3.5 py-3">
            <span className="text-base leading-none mt-0.5 shrink-0">🔒</span>
            <div>
              <p className="text-xs font-semibold text-primary/70 leading-snug">
                Booking via ShelterDK
              </p>
              <p className="text-xs text-primary/45 leading-relaxed mt-0.5">
                ShelterDK er en dansk platform for shelter-booking. Servicegebyret dækker administration af din booking.{" "}
                <span className="text-primary/60 font-medium">CVR {SHELTER_DK_CVR}</span>
              </p>
            </div>
          </div>
```

- [ ] **Step 3: Tilføj trust-noten i multiple-units-branchen**

Find præcist denne linje (linje 163):
```tsx
          </div>
        </>
      ) : bookingUnits.length === 1 ? (
```

Det er `</div>` der lukker `<div className="space-y-2.5">`, efterfulgt af `</>` der lukker fragmentet. Indsæt trust-noten **mellem** `</div>` og `</>`:

```tsx
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/8 bg-primary/[0.03] px-3.5 py-3">
            <span className="text-base leading-none mt-0.5 shrink-0">🔒</span>
            <div>
              <p className="text-xs font-semibold text-primary/70 leading-snug">
                Booking via ShelterDK
              </p>
              <p className="text-xs text-primary/45 leading-relaxed mt-0.5">
                ShelterDK er en dansk platform for shelter-booking. Servicegebyret dækker administration af din booking.{" "}
                <span className="text-primary/60 font-medium">CVR {SHELTER_DK_CVR}</span>
              </p>
            </div>
          </div>
        </>
      ) : bookingUnits.length === 1 ? (
```

- [ ] **Step 4: Verificér visuelt**

Start dev-server: `cd web && npm run dev`

Åbn en shelter med enkelt ShelterDK-booking:
`http://localhost:3000/shelter/shelterplads-ved-solvognens-fundsted-11573-shelter-6`

Tjek:
- Trust-noten vises under "Book dette shelter"-knappen
- CVR-nummeret er synligt: "CVR 44 37 89 65"
- Mobilvisning (DevTools → responsive): noten er kompakt og læsbar
- En ekstern booking (fx Naturstyrelsen-shelter): trust-noten vises IKKE

- [ ] **Step 5: Commit**

```bash
git add components/ShelterDetailContent.tsx
git commit -m "feat: tilføj trust-note med CVR på shelter-detaljesiden"
```

---

## Task 2: "Om ShelterDK"-blok i booking-formularen

**Fil:** `components/booking/BookingForm.tsx`

### Struktur i filen

Helper-funktioner på linje 29–58: `ChevronIcon`, `CalendarIcon`, `CheckIcon`.

Trust-signals bruges to steder:
- **Desktop** (linje ~194–204): `hidden md:flex` div — vises under kalenderen på store skærme
- **Mobil** (linje ~384–394): `flex md:hidden` div — vises under formularen på små skærme

`isUpfront` er defineret på linje 137: `const isUpfront = paymentMode === "upfront";`

- [ ] **Step 1: Tilføj CVR-konstant**

Find linjen `"use client";` øverst i `components/booking/BookingForm.tsx`. Tilføj konstanten efter alle imports, på en ny linje:

```tsx
const SHELTER_DK_CVR = "44 37 89 65";
```

- [ ] **Step 2: Tilføj `UpfrontTrustBlock`-komponent**

Indsæt denne komponent på linje 60 — dvs. umiddelbart efter `CheckIcon`-funktionen (der slutter linje 58) og før `BookingFormProps`-interfacet:

```tsx
function UpfrontTrustBlock() {
  return (
    <div className="rounded-xl border border-primary/10 bg-white px-4 py-3.5">
      <p className="text-xs font-semibold text-primary/70 mb-1.5">Om ShelterDK</p>
      <p className="text-xs text-primary/50 leading-relaxed mb-3">
        ShelterDK er en dansk platform til at finde og booke shelters i hele Danmark.
        Servicegebyret betales til ShelterDK og dækker administration af din booking.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-primary/45">
          <span>🏢</span>
          <span>CVR {SHELTER_DK_CVR}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-primary/45">
          <span>🔒</span>
          <span>Betaling via Stripe</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-primary/45">
          <span>↩️</span>
          <span>Fuld refundering ved aflysning</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Opdatér `trustSignals` — fjern upfront-varianten**

Find (linje ~142–144):
```tsx
  const trustSignals = isUpfront
    ? ["Sikker betaling via MobilePay eller kort", "Booking bekræftes automatisk ved betaling", "Fuld refundering hvis du aflyser mere end 24 timer før ankomst"]
    : ["Gratis at sende en forespørgsel", "Du betaler ingenting nu", "Ejer svarer typisk inden 24 timer"];
```

Erstat med:
```tsx
  const trustSignals = ["Gratis at sende en forespørgsel", "Du betaler ingenting nu", "Ejer svarer typisk inden 24 timer"];
```

`trustSignals` bruges herefter kun i `after_confirmation`-mode.

- [ ] **Step 4: Erstat desktop trust-bullets**

Find præcist (linje ~194–204):
```tsx
          {/* Trust signals – desktop only */}
          <div className="hidden md:flex flex-col gap-2 mt-5">
            {trustSignals.map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <CheckIcon />
                </div>
                <span className="text-xs text-primary/50">{t}</span>
              </div>
            ))}
          </div>
```

Erstat med:
```tsx
          {/* Trust signals – desktop only */}
          <div className="hidden md:block mt-5">
            {isUpfront ? (
              <UpfrontTrustBlock />
            ) : (
              <div className="flex flex-col gap-2">
                {trustSignals.map((t) => (
                  <div key={t} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <CheckIcon />
                    </div>
                    <span className="text-xs text-primary/50">{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
```

- [ ] **Step 5: Erstat mobil trust-bullets**

Find præcist (linje ~384–394):
```tsx
          {/* Trust – mobile only */}
          <div className="flex md:hidden flex-col gap-2 pt-1">
            {trustSignals.map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <CheckIcon />
                </div>
                <span className="text-xs text-primary/50">{t}</span>
              </div>
            ))}
          </div>
```

Erstat med:
```tsx
          {/* Trust – mobile only */}
          <div className="md:hidden pt-1">
            {isUpfront ? (
              <UpfrontTrustBlock />
            ) : (
              <div className="flex flex-col gap-2">
                {trustSignals.map((t) => (
                  <div key={t} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <CheckIcon />
                    </div>
                    <span className="text-xs text-primary/50">{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
```

- [ ] **Step 6: Verificér visuelt**

Dev-server kører. Åbn booking-formularen for et upfront-shelter:
`http://localhost:3000/book/shelterplads-ved-solvognens-fundsted-11573`

Tjek:
- "Om ShelterDK"-boksen vises under kalenderen (desktop) og under formularen (mobil)
- CVR 44 37 89 65 er synligt
- De tre badges vises (CVR, Stripe, Refundering)
- `after_confirmation`-mode: åbn et after_confirmation-shelter og bekræft at de tre grønne bullets stadig vises korrekt

- [ ] **Step 7: Kør tests**

```bash
cd web && npm test
```

Expected: alle tests passer — ingen eksisterende tests er afhængige af de ændrede trust-bullets.

- [ ] **Step 8: Commit**

```bash
git add components/booking/BookingForm.tsx
git commit -m "feat: erstat upfront trust-bullets med Om ShelterDK-blok med CVR"
```

---

## Task 3: Deploy

- [ ] **Step 1: Push til GitHub**

```bash
git push
```

Netlify deployer automatisk fra `main`.

- [ ] **Step 2: Verificér på produktion**

Åbn `https://shelterdk.dk/shelter/shelterplads-ved-solvognens-fundsted-11573-shelter-6`
→ Trust-noten skal være synlig under booking-knappen.

Åbn booking-formularen for samme shelter.
→ "Om ShelterDK"-boksen skal være synlig.
