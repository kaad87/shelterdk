# Booking Trust Signals — Design Spec

## Problemet

Brugere der lander på en ShelterDK-bookingside — enten fra Google eller fra shelter-detaljesiden — møder pludselig en betalingsformular fra en platform de ikke kender. Det kan virke scamagtigt. Problemet er primært platformens ukendte status, ikke selve gebyrets eksistens.

To punkter i rejsen mangler tillidsopbygning:

1. **Shelter-detaljesiden** — ingen forklaring af hvad ShelterDK er eller at der er et gebyr, inden brugeren klikker "Book"
2. **Booking-formularen** — gebyret dukker op uden kontekst; de nuværende trust-bullets er generiske og nævner ikke CVR eller hvad platformen er

## Løsning

To uafhængige, kompakte UI-ændringer. Begge vises kun der hvor de er relevante.

---

### Ændring 1: Trust-note på shelter-detaljesiden

**Fil:** `components/ShelterDetailContent.tsx`

**Placering:** Direkte over/ved booking-knappen — kun når `bookingMode === "shelterdk"` (ikke Naturstyrelsen-links, ikke eksterne booking-URLs).

**Indhold:**
- 🔒-ikon + kort heading: "Booking via ShelterDK"
- Én linje tekst: hvad ShelterDK er, og at servicegebyret dækker administration af bookingen
- CVR-nummer synligt (CVR 44 37 89 65)

**Format:** Kompakt boks i samme stil som eksisterende shelter-info-elementer. Diskret — må ikke overdøve shelter-beskrivelsen.

**Kondition:** Kun render for shelters med `bookingMode === "shelterdk"`. Shelters med ekstern `bookingUrl` eller Naturstyrelsen-hint viser ikke boksen.

---

### Ændring 2: "Om ShelterDK"-blok i booking-formularen

**Fil:** `components/booking/BookingForm.tsx`

**Placering:** Erstatter de nuværende 3 trust-bullets i `upfront`-mode. `after_confirmation`-mode ændres ikke (der er ingen betaling, ingen grund til payment trust-signaler).

**Indhold:**
- Heading: "Om ShelterDK"
- 2 sætninger: ShelterDK er en dansk platform til at finde og booke shelters; servicegebyret betales til ShelterDK og dækker administration
- Tre kompakte badges:
  - 🏢 CVR 44 37 89 65
  - 🔒 Betaling via Stripe
  - ↩️ Fuld refundering ved aflysning (> 24 timer)

**Format:** Bordered card-boks, samme visuelle hierarki som pris-oversigten ovenover. Ikke dominerende — understøtter beslutningen, overdøver ikke.

---

## Hvad der ikke ændres

- Stripe checkout-siden (Stripes eget UI er tillids-skabende nok)
- `after_confirmation`-mode trust-signals (andre budskaber er relevante der)
- Ejer-dashboard, admin-panel, API-routes
- Priser og gebyr-logik

## CVR-nummer

CVR 44 37 89 65 — hardcodes som konstant i begge komponenter.

## Succeskriterier

- Brugere ser CVR og platformsforklaring inden de klikker "Book"
- Brugere ser CVR og platformsforklaring igen på betalingsformularen
- Ingen ekstra API-kald, ingen nye DB-felter
- Mobilvisning: begge elementer er kompakte og brugbare på lille skærm
