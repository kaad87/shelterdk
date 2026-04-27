# Booking Messages — Design

**Dato:** 2026-04-27
**Status:** Godkendt af bruger

---

## Mål

Giv gæster og ejere mulighed for at skrive direkte til hinanden inden for rammerne af en booking. Beskeder gemmes i databasen og vises inline på eksisterende sider — gæstens `/min-booking/[guestToken]` og ejerens dashboard. Begge parter får en email-notifikation ved nye beskeder.

---

## Arkitektur

### Stack
- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres)
- Resend (email)

### Komponenter

```
supabase/migrations/20260427_booking_messages.sql
types/booking.ts                                      ← +BookingMessage interface
lib/messages-db.ts                                    ← ny: DB-helpers til beskeder
lib/booking-email.ts                                  ← +sendNewMessageToOwner, +sendNewMessageToGuest
app/api/booking/[guestToken]/messages/route.ts        ← ny: GET + POST for gæst
app/api/owner/[token]/booking/[bookingId]/messages/route.ts  ← ny: GET + POST for ejer
app/(site)/min-booking/[guestToken]/BookingPageClient.tsx    ← udvides med besked-sektion
components/owner/OwnerDashboard.tsx                   ← udvides med badge + inline tråd-panel
```

**Afgrænset scope:** Beskeder er udelukkende knyttet til bookinger. Generelle "kontakt ejer"-forespørgsler og auto-besked templates (`booking_message_templates`) er separate systemer og berøres ikke.

---

## Database

### Migration

```sql
CREATE TABLE booking_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES shelter_bookings(id) ON DELETE CASCADE,
  sender     TEXT        NOT NULL CHECK (sender IN ('guest', 'owner')),
  body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ            -- NULL = ulæst af modtageren
);

CREATE INDEX booking_messages_booking_created
  ON booking_messages(booking_id, created_at);
```

**`read_at`-semantik:** Markeres automatisk når modtageren henter tråden (batch UPDATE). Ingen eksplicit "mark as read"-knap — hentning er nok.

---

## TypeScript-typer

Tilføjes i `types/booking.ts`:

```typescript
export interface BookingMessage {
  id: string;
  booking_id: string;
  sender: "guest" | "owner";
  body: string;
  created_at: string;
  read_at: string | null;
}
```

---

## DB-helpers (`lib/messages-db.ts`)

Fire funktioner med klare single-purpose grænser:

```typescript
// Hent alle beskeder for en booking, ældst først
getMessagesForBooking(bookingId: string): Promise<BookingMessage[]>

// Opret en ny besked
createMessage(bookingId: string, sender: "guest" | "owner", body: string): Promise<BookingMessage>

// Markér alle beskeder fra en given afsender som læst (batch).
// senderToMark = hvem der SENDTE beskederne (ikke hvem der læser).
// Eks: ejer åbner tråden → markMessagesRead(id, "guest") markerer gæstens beskeder som læst af ejeren.
markMessagesRead(bookingId: string, senderToMark: "guest" | "owner"): Promise<void>

// Tæl ulæste beskeder per booking (til dashboard badge)
// Returnerer Record<bookingId, count>
getUnreadCountsForShelter(bookableShelterDbId: string, reader: "owner"): Promise<Record<string, number>>
```

`getUnreadCountsForShelter` bruges til at vise ✉-badges på alle bookinger i dashboardet med ét enkelt DB-kald i stedet for N kald.

---

## API

### Gæst: `GET /api/booking/[guestToken]/messages`

1. Slå booking op via `guestToken` (404 hvis ikke fundet)
2. Hent tråd via `getMessagesForBooking`
3. Markér ejer-beskeder som læst (`markMessagesRead(..., "owner")`)
4. Returnér `{ messages: BookingMessage[] }`

### Gæst: `POST /api/booking/[guestToken]/messages`

Body: `{ body: string }`

1. Validér `body` (1–2000 tegn)
2. Slå booking op (404 hvis ikke fundet)
3. Opret besked via `createMessage(..., "guest", body)`
4. Send `sendNewMessageToOwner` (non-fatal)
5. Returnér `{ message: BookingMessage }`

### Ejer: `GET /api/owner/[token]/booking/[bookingId]/messages`

1. Autentificér via `owner_token` (401 hvis ukendt)
2. Verificér at bookingen tilhører dette shelter (404 ellers)
3. Hent tråd
4. Markér gæst-beskeder som læst (`markMessagesRead(..., "guest")`)
5. Returnér `{ messages: BookingMessage[] }`

### Ejer: `POST /api/owner/[token]/booking/[bookingId]/messages`

Body: `{ body: string }`

1. Autentificér + verificér booking-ejerskab
2. Validér `body`
3. Opret besked via `createMessage(..., "owner", body)`
4. Hent booking for at finde `guest_email`, `guest_token`, `guest_name`
5. Send `sendNewMessageToGuest` (non-fatal)
6. Returnér `{ message: BookingMessage }`

**Bemærk:** `/api/owner/[token]/messages` eksisterer allerede og håndterer auto-besked templates. Den nye sti `/api/owner/[token]/booking/[bookingId]/messages` konflikterer ikke.

---

## Email-notifikationer (`lib/booking-email.ts`)

```typescript
// ownerEmail og ownerToken hentes fra bookable_shelters via booking.bookable_shelter_id
sendNewMessageToOwner(opts: {
  ownerEmail: string;
  ownerToken: string;
  guestName: string;
  shelterTitle: string;
  messageBody: string;
}): Promise<void>
// Emne: "Ny besked fra [gæst] om [shelter]"
// Link: /owner/[ownerToken]

sendNewMessageToGuest(opts: {
  guestEmail: string;
  guestName: string;
  guestToken: string;
  shelterTitle: string;
  messageBody: string;
}): Promise<void>
// Emne: "Ny besked fra ejeren af [shelter]"
// Link: /min-booking/[guestToken]
```

Begge er non-fatal (try/catch i API-routes). Ingen throttling i første version.

---

## UI

### Gæst (`BookingPageClient.tsx`)

Ny sektion under bookingdetalje-kortet:

- Overskrift "Beskeder" med besked-antal
- Boble-layout: ejerens beskeder venstre-alignet (grå), gæstens højre-alignet (accent-farve `#c5a059`)
- "Ny"-markering på ulæste beskeder
- Textarea + Send-knap nederst
- Optimistisk UI: besked tilføjes til lokal state ved send (uden at vente på server)
- Fejlbesked ved netværksfejl

### Ejer (`OwnerDashboard.tsx`)

**Dashboard-siden henter `unreadCounts` ved mount** via `getUnreadCountsForShelter` (ét kald).

Per bekræftet/afventende booking:
- ✉-badge `"N ny"` vises hvis `unreadCounts[b.id] > 0`
- "Skriv"-knap vises hvis ingen ulæste beskeder (men stadig klikbar)
- Klik på badge/knap henter tråden og folder et inline panel ud under booking-rækken
- Panel: boble-layout + textarea + Send
- Badge forsvinder efter tråden er hentet (markeret som læst)
- Ingen auto-polling — tråden genindlæses kun ved åbning eller efter send

---

## Fejlhåndtering

| Situation | Håndtering |
|-----------|-----------|
| Besked > 2000 tegn | 400 fra API, fejlbesked i UI |
| Booking ikke fundet | 404 |
| Email-notifikation fejler | Logges, stopper ikke API-svar |
| Concurrent sends | Sidste vinder — ingen race condition (inserts er uafhængige) |

---

## Hvad der ikke er med (YAGNI)

- Pagination (MVP antager < 100 beskeder per booking)
- Throttling af email-notifikationer
- Læsekvitteringer som explicit UI-element
- Push/WebSocket real-time (polling ved behov er tilstrækkeligt)
- Besked-sletning
- Vedhæftede filer

---

## Tests

- Unit: `createMessage`, `getUnreadCountsForShelter` med mock Supabase-klient
- Integration: GET/POST routes returnerer korrekte statuskoder og body
- Edge cases: tom body, body > 2000 tegn, ukendt guestToken
