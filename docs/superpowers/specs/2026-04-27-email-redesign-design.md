# Email Redesign — Design Spec

## Goal

Redesign alle transaktionelle emails fra ShelterDK for at forbedre leverbarhed (spam-problemer) og visuel kvalitet. Ingen nye funktioner — kun et løft af eksisterende emails.

## Problem

1. **Spam**: Emails fra `no-reply@shelterdk.dk` ryger i spam. To årsager: (a) `no-reply`-afsenderadresse er et klassisk spam-signal, (b) alle emails sendes kun som HTML uden plain-text fallback, hvilket spam-filtre straffer.
2. **Design**: Emails er bygget med rå inline-HTML uden konsistent branding, ingen logo/wordmark, og ingen visuel sammenhæng med ShelterDK-brandet.

SPF og DKIM er korrekt sat op i Resend — domænet er verificeret.

## Design

### Visuel stil

Style C — varm/nature-feel der matcher ShelterDK-brandet:

- **Baggrund**: Varm beige (`#f0ede8`) som ydre wrapper
- **Kort**: Hvidt med afrundede hjørner (`border-radius: 10px`) og let skygge
- **Header**: Mørk slate (`#2C3E50`), padding `18px 24px`. Øverst: `SHELTERDK` i guld (`#c5a059`), `font-size: 10px`, `font-weight: 700`, `letter-spacing: 2px`, `text-transform: uppercase`. Nedenunder: email-titlen i hvid, `font-size: 15px`, `font-weight: 600`
- **Info-bokse**: Varm beige baggrund (`#f9f7f4`) med guld venstre-border (`#c5a059`) — bruges til datoer og nøgleinfo
- **Primær knap**: Guld (`#c5a059`) med hvid tekst
- **Footer**: Lysegrå baggrund (`#faf9f7`) med diskret tekst og link til shelterdk.dk
- **Bekræftelses-bokse**: Grøn variant (`#f0fdf4` / `#16a34a`) bruges kun ved bekræftede bookinger

### Delt skabelon

Én `renderEmail(opts)` funktion i `lib/email.ts`:

```typescript
interface RenderEmailOpts {
  title: string;        // Vises i header (hvid tekst)
  bodyHtml: string;     // Indhold mellem header og footer
  preheader?: string;   // Skjult preview-tekst til email-klienter
}

function renderEmail(opts: RenderEmailOpts): string
```

Returnerer komplet HTML-streng med header, body og footer. Alle email-funktioner bruger denne wrapper i stedet for at bygge deres eget HTML.

### Plain-text helper

Én `renderEmailText(opts)` funktion der producerer en ren plain-text version til `text:`-feltet på alle Resend-kald:

```typescript
interface RenderEmailTextOpts {
  title: string;
  lines: string[];   // Afsnit i plain tekst
  url?: string;      // Valgfrit link til sidst
}

function renderEmailText(opts: RenderEmailTextOpts): string
```

Output-format (fast struktur):
```
SHELTERDK — {title}
──────────────────────────────

{lines[0]}

{lines[1]}

...

{url hvis angivet}

──────────────────────────────
shelterdk.dk
```

Titlen skrives som `SHELTERDK — {title}` i plain caps. Separator er 30 bindestreger. Footer tilføjes automatisk (som `renderEmail()` gør det for HTML). Hvert element i `lines` separeres med blank linje.

### Afsenderadresse

`FROM_EMAIL` ændres fra `ShelterDK <no-reply@shelterdk.dk>` til `ShelterDK <hej@shelterdk.dk>`.

## Særlige tilfælde

### sendBookingAutoMessage
Denne funktion rendrer ejerens fritekst-skabelon med pladsholdere. Den eksisterende `applyMessagePlaceholders()`-logik bevares uændret. Resultatet (newline → `<br>`) indsættes som `bodyHtml` i `renderEmail()` — samme wrapper som alle andre. Plain-text udgaven bevarer newlines direkte i `lines`-arrayet.

### sendBookingRequestToOwner — accept/afvis-knapper
Denne mail har to CTA-knapper med semantisk farve: **Acceptér** (grøn `#16a34a`) og **Afvis** (rød `#dc2626`). Disse to bevares med deres farver — gold-knappen bruges ikke her, da farven er meningsbærende. `renderEmail()` wrapper stadig header og footer; knapperne er blot en del af `bodyHtml`.

### sendPaymentConfirmed og sendBookingExpired
Begge funktioner sender to uafhængige emails (gæst + ejer) i samme kald. Hvert `resend.emails.send()`-kald får sit eget selvstændige `html:` og `text:` fra `renderEmail()` / `renderEmailText()` — to separate kald til wrapperne.

## Scope

Alle 16 email-funktioner opdateres:

**`lib/email.ts`**
- `sendContactEmail` — turvenner-kontaktmail

**`lib/booking-email.ts`** (15 funktioner)
- `sendBookingAutoMessage`
- `sendBookingRequestToOwner`
- `sendBookingReceivedToGuest`
- `sendBookingConfirmedToGuest`
- `sendBookingRejectedToGuest`
- `sendPaymentRequestToGuest`
- `sendPaymentConfirmed`
- `sendUpfrontPaymentReceived`
- `sendRefundedToGuest`
- `sendBookingExpired`
- `sendGuestCancelledToGuest`
- `sendGuestCancelledToOwner`
- `sendOwnerCancelledToGuest`
- `sendNewMessageToOwner`
- `sendNewMessageToGuest`

## Hvad der IKKE ændres

- Resend-opsætning og API-kald (kun `html:` og `text:` felterne)
- Email-logik (hvornår mails sendes, hvem der modtager)
- Database eller API-routes
- `applyMessagePlaceholders` og auto-besked-systemet (bruger fortsat samme flow — kun HTML-wrapperen skiftes)

## Verifikation

1. Send en test-booking → gæst modtager "forespørgsel modtaget" med ny design
2. Bekræft booking → gæst modtager bekræftelse med grøn info-boks
3. Send besked → modtager notifikation med blockquote-stil
4. Tjek i Outlook og Gmail at plain-text version vises korrekt
5. Tjek at mailen ikke ryger i spam (Outlook junk-test)
