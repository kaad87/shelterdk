# Email Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign alle transaktionelle emails med konsistent Style C-branding, tilføj plain-text fallbacks, og skift afsenderadresse til `hej@shelterdk.dk` for at reducere spam-filtrering.

**Architecture:** To rene hjælpefunktioner (`renderEmail` + `renderEmailText`) tilføjes i `lib/email.ts` og returnerer komplet HTML/text. Alle 15 booking-email-funktioner i `lib/booking-email.ts` og `sendContactEmail` i `lib/email.ts` opdateres til at bruge disse. Ingen ændringer til email-logik, routing eller database.

**Tech Stack:** TypeScript, Resend SDK, Vitest

---

## File Map

| Fil | Handling | Ansvar |
|-----|----------|--------|
| `web/lib/email.ts` | Ændr | Tilføj `renderEmail()` + `renderEmailText()`, skift `FROM_EMAIL`, opdater `sendContactEmail()` |
| `web/lib/booking-email.ts` | Ændr | Opdater alle 15 send-funktioner til ny skabelon + `text:` felt |
| `web/lib/__tests__/email-template.test.ts` | Opret | 13 unit tests for de to rene hjælpefunktioner |

---

### Task 1: Skabelon-hjælpere + sendContactEmail (TDD)

**Filer:**
- Opret: `web/lib/__tests__/email-template.test.ts`
- Ændr: `web/lib/email.ts`

- [ ] **Step 1: Skriv de fejlende tests**

Opret `web/lib/__tests__/email-template.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderEmail, renderEmailText } from "../email";

describe("renderEmail()", () => {
  it("produces a complete HTML document", () => {
    const html = renderEmail({ title: "Test", bodyHtml: "<p>body</p>" });
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("includes the title in the header", () => {
    const html = renderEmail({ title: "Min titel", bodyHtml: "<p>x</p>" });
    expect(html).toContain("Min titel");
  });

  it("shows SHELTERDK wordmark", () => {
    const html = renderEmail({ title: "T", bodyHtml: "" });
    expect(html).toContain("SHELTERDK");
  });

  it("renders bodyHtml verbatim", () => {
    const html = renderEmail({ title: "T", bodyHtml: '<p class="x">hello</p>' });
    expect(html).toContain('<p class="x">hello</p>');
  });

  it("includes footer link to shelterdk.dk", () => {
    const html = renderEmail({ title: "T", bodyHtml: "" });
    expect(html).toContain("shelterdk.dk");
  });

  it("includes preheader div when provided", () => {
    const html = renderEmail({ title: "T", bodyHtml: "", preheader: "Preview text here" });
    expect(html).toContain("Preview text here");
  });

  it("omits preheader element when not provided", () => {
    const html = renderEmail({ title: "T", bodyHtml: "" });
    expect(html).not.toContain("mso-hide:all");
  });

  it("escapes title for XSS", () => {
    const html = renderEmail({ title: '<script>alert(1)</script>', bodyHtml: "" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderEmailText()", () => {
  it("starts with SHELTERDK — {title}", () => {
    const text = renderEmailText({ title: "Booking bekræftet", lines: [] });
    expect(text).toContain("SHELTERDK — Booking bekræftet");
  });

  it("includes all lines", () => {
    const text = renderEmailText({ title: "T", lines: ["Hej Lars", "Din booking er klar"] });
    expect(text).toContain("Hej Lars");
    expect(text).toContain("Din booking er klar");
  });

  it("includes url when provided", () => {
    const text = renderEmailText({ title: "T", lines: [], url: "https://shelterdk.dk/min-booking/abc" });
    expect(text).toContain("https://shelterdk.dk/min-booking/abc");
  });

  it("omits url section when not provided", () => {
    const text = renderEmailText({ title: "T", lines: ["Hej"] });
    expect(text).not.toContain("https://");
  });

  it("ends with shelterdk.dk", () => {
    const text = renderEmailText({ title: "T", lines: [] });
    expect(text.trim().endsWith("shelterdk.dk")).toBe(true);
  });
});
```

- [ ] **Step 2: Kør tests og bekræft at de fejler**

```bash
cd web && npx vitest run lib/__tests__/email-template.test.ts
```

Forventet: FAIL — `renderEmail is not a function`.

- [ ] **Step 3: Implementér hjælperne og skift FROM_EMAIL**

I `web/lib/email.ts`, erstat linje 4 og tilføj efter `escapeHtml`:

```typescript
export const FROM_EMAIL = "ShelterDK <hej@shelterdk.dk>";

// ─── Email template helpers ───────────────────────────────────────────────────

export interface RenderEmailOpts {
  title: string;      // Vises i header (escapes automatisk)
  bodyHtml: string;   // Indhold — caller er ansvarlig for at escape dynamiske værdier
  preheader?: string; // Skjult preview-tekst (escapes automatisk)
}

export interface RenderEmailTextOpts {
  title: string;
  lines: string[];
  url?: string;
}

export function renderEmail(opts: RenderEmailOpts): string {
  const { bodyHtml, preheader } = opts;
  const safeTitle = escapeHtml(opts.title);
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,Arial,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">
      <tr>
        <td style="background:#2C3E50;padding:18px 24px;">
          <p style="color:#c5a059;font-size:10px;font-weight:700;letter-spacing:2px;margin:0 0 3px;text-transform:uppercase;">SHELTERDK</p>
          <p style="color:white;font-size:15px;font-weight:600;margin:0;line-height:1.3;">${safeTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px 16px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#faf9f7;border-top:1px solid #ede9e1;padding:11px 24px;">
          <p style="font-size:10px;color:#bbb;margin:0;">Sendt via <a href="https://shelterdk.dk" style="color:#c5a059;text-decoration:none;">shelterdk.dk</a> · Find shelters i hele Danmark</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(opts: RenderEmailTextOpts): string {
  const { title, lines, url } = opts;
  const sep = "-".repeat(30);
  const parts: string[] = [`SHELTERDK — ${title}`, sep, ""];
  for (const line of lines) {
    parts.push(line, "");
  }
  if (url) {
    parts.push(url, "");
  }
  parts.push(sep, "shelterdk.dk");
  return parts.join("\n");
}
```

- [ ] **Step 4: Opdater sendContactEmail**

Erstat hele `sendContactEmail`-funktionen:

```typescript
export async function sendContactEmail(opts: {
  toEmail: string;
  toName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  postTitle: string;
}) {
  const { toEmail, toName, senderName, senderEmail, message, postTitle } = opts;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: senderEmail,
    subject: `Ny besked om dit opslag: ${postTitle}`,
    html: renderEmail({
      title: "Ny besked via Turvenner",
      preheader: `${senderName} har sendt dig en besked om "${postTitle}".`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">Hej <strong>${escapeHtml(toName)}</strong>! Du har fået en besked om dit opslag <strong>"${escapeHtml(postTitle)}"</strong> på ShelterDK.</p>
        <p style="font-size:13px;color:#666;margin:0 0 4px;"><strong>Fra:</strong> ${escapeHtml(senderName)} (${escapeHtml(senderEmail)})</p>
        <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:12px 0;padding:10px 14px;border-radius:0 6px 6px 0;">
          <p style="font-size:13px;color:#555;line-height:1.5;margin:0;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        </blockquote>
        <p style="font-size:12px;color:#999;margin:12px 0 0;">Du kan svare direkte på denne email for at kontakte ${escapeHtml(senderName)}.</p>
      `,
    }),
    text: renderEmailText({
      title: "Ny besked via Turvenner",
      lines: [
        `Hej ${toName}! Du har fået en besked om dit opslag "${postTitle}".`,
        `Fra: ${senderName} (${senderEmail})`,
        message,
        "Du kan svare direkte på denne email.",
      ],
    }),
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error("Kunne ikke sende email.");
  }
}
```

- [ ] **Step 5: Kør tests og bekræft at de består**

```bash
cd web && npx vitest run lib/__tests__/email-template.test.ts
```

Forventet: 13 tests PASS.

- [ ] **Step 6: Kør fuld testsuite**

```bash
cd web && npx vitest run
```

Forventet: Alle tests består (248+).

- [ ] **Step 7: Commit**

```bash
git add web/lib/__tests__/email-template.test.ts web/lib/email.ts
git commit -m "feat: add renderEmail/renderEmailText helpers, change FROM_EMAIL to hej@shelterdk.dk

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 8 simple booking email funktioner

**Filer:**
- Ændr: `web/lib/booking-email.ts`

**Mønster:** Alle 8 funktioner følger dette:
- `html: renderEmail({ title, preheader?, bodyHtml })`
- `text: renderEmailText({ title, lines, url? })`
- `title` og `preheader` sendes som rå strings — `renderEmail` escaper dem
- Dynamiske værdier i `bodyHtml` wrappet med `esc()`

**Vigtigt:** Kun import-linjen og send-funktionerne ændres. Bevar alle eksisterende hjælpere i filen uændret: `esc`, `formatDate`, `bookingLink`, `SITE_URL`, `AutoMessageContext`, og `applyMessagePlaceholders`. Alle nye funktionskroppe bruger disse.

- [ ] **Step 1: Opdater import-linje**

Øverst i `web/lib/booking-email.ts`, erstat:
```typescript
import { getResend, FROM_EMAIL, escapeHtml } from "./email";
```
Med:
```typescript
import { getResend, FROM_EMAIL, escapeHtml, renderEmail, renderEmailText } from "./email";
```

- [ ] **Step 2: sendBookingReceivedToGuest + sendBookingConfirmedToGuest**

```typescript
export async function sendBookingReceivedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Vi har modtaget din forespørgsel til ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: "Forespørgsel modtaget",
      preheader: `Din forespørgsel til ${opts.shelterTitle} er modtaget. Ejeren vender tilbage hurtigst muligt.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Vi har modtaget din bookingforespørgsel til <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
          <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
          <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
        </div>
        <p style="font-size:13px;color:#666;margin:0;line-height:1.5;">Ejeren vender tilbage hurtigst muligt.</p>
      `,
    }),
    text: renderEmailText({
      title: "Forespørgsel modtaget",
      lines: [
        `Hej ${opts.guestName}! Vi har modtaget din bookingforespørgsel til ${opts.shelterTitle}.`,
        `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
        "Ejeren vender tilbage hurtigst muligt.",
      ],
    }),
  });
  if (error) throw new Error("Email-fejl (gæst modtaget): " + JSON.stringify(error));
}

export async function sendBookingConfirmedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  guestToken: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking er bekræftet!`,
    html: renderEmail({
      title: "Din booking er bekræftet!",
      preheader: `Din booking af ${opts.shelterTitle} er bekræftet. God tur!`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Din booking af <strong>${esc(opts.shelterTitle)}</strong> er nu bekræftet.</p>
        <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
          <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Bekræftet ophold</p>
          <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
        </div>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">God tur!</p>
        <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se og administrér din booking</a>
      `,
    }),
    text: renderEmailText({
      title: "Din booking er bekræftet!",
      lines: [
        `Hej ${opts.guestName}! Din booking af ${opts.shelterTitle} er nu bekræftet.`,
        `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
        "God tur!",
      ],
      url: bookingLink(opts.guestToken),
    }),
  });
  if (error) throw new Error("Email-fejl (gæst bekræftet): " + JSON.stringify(error));
}
```

- [ ] **Step 3: sendBookingRejectedToGuest + sendPaymentRequestToGuest**

```typescript
export async function sendBookingRejectedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din bookingforespørgsel til ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: "Forespørgsel ikke imødekommet",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
        <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 16px;">Desværre kunne ejeren ikke imødekomme din forespørgsel til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
      `,
    }),
    text: renderEmailText({
      title: "Forespørgsel ikke imødekommet",
      lines: [
        `Hej ${opts.guestName},`,
        `Desværre kunne ejeren ikke imødekomme din forespørgsel til ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
        "Find andre shelters på shelterdk.dk",
      ],
      url: "https://shelterdk.dk/soeg",
    }),
  });
  if (error) throw new Error("Email-fejl (gæst afvist): " + JSON.stringify(error));
}

export async function sendPaymentRequestToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  amountShelterDkk: number;
  amountPlatformDkk: number;
  paymentUrl: string;
  guestToken: string;
}) {
  const overnatningRow = opts.amountShelterDkk > 0
    ? `<tr><td style="font-size:12px;color:#666;padding:4px 0;">Overnatning</td><td style="font-size:12px;text-align:right;padding:4px 0;">${opts.amountShelterDkk} kr</td></tr>`
    : "";
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Betal din booking af ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: "Din booking er klar til betaling",
      preheader: `Betal inden 24 timer for at bekræfte din booking af ${opts.shelterTitle}.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Ejeren har bekræftet din booking af <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
          <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
          <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          ${overnatningRow}
          <tr><td style="font-size:12px;color:#666;padding:4px 0;">Administrationsgebyr</td><td style="font-size:12px;text-align:right;padding:4px 0;">${opts.amountPlatformDkk} kr</td></tr>
          <tr style="border-top:1px solid #e5e1d8;"><td style="font-size:13px;font-weight:600;color:#2C3E50;padding:6px 0;">I alt</td><td style="font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${opts.amountTotalDkk} kr</td></tr>
        </table>
        <p style="font-size:12px;color:#999;margin:0 0 16px;">Betalingslinket udløber om 24 timer.</p>
        <a href="${opts.paymentUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Betal nu via MobilePay</a>
      `,
    }),
    text: renderEmailText({
      title: "Din booking er klar til betaling",
      lines: [
        `Hej ${opts.guestName}! Ejeren har bekræftet din booking af ${opts.shelterTitle}.`,
        `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
        `I alt: ${opts.amountTotalDkk} kr (heraf ${opts.amountPlatformDkk} kr administrationsgebyr).`,
        "Betalingslinket udløber om 24 timer.",
      ],
      url: opts.paymentUrl,
    }),
  });
  if (error) throw new Error("Email-fejl (gæst betaling): " + JSON.stringify(error));
}
```

- [ ] **Step 4: sendUpfrontPaymentReceived + sendRefundedToGuest**

```typescript
export async function sendUpfrontPaymentReceived(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Forudbetalt booking til ${esc(opts.shelterTitle)} — afventer din bekræftelse`,
    html: renderEmail({
      title: "Ny forudbetalt booking",
      preheader: `${opts.guestName} har forudbetalt ${opts.amountTotalDkk} kr for ${opts.shelterTitle}. Afventer din bekræftelse.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) har forudbetalt <strong>${opts.amountTotalDkk} kr</strong> for <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
          <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
          <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
        </div>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Gæsten afventer din bekræftelse. Afviser du bookingen, refunderes betalingen automatisk.</p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Gå til dit dashboard</a>
      `,
    }),
    text: renderEmailText({
      title: "Ny forudbetalt booking",
      lines: [
        `${opts.guestName} (${opts.guestEmail}) har forudbetalt ${opts.amountTotalDkk} kr for ${opts.shelterTitle}.`,
        `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
        "Gæsten afventer din bekræftelse. Afviser du bookingen, refunderes betalingen automatisk.",
      ],
      url: dashboardUrl,
    }),
  });
  if (error) throw new Error("Email-fejl (forudbetaling ejer): " + JSON.stringify(error));
}

export async function sendRefundedToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er afvist — refundering på vej`,
    html: renderEmail({
      title: "Booking afvist — refundering på vej",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
        <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 10px;">Desværre kunne ejeren ikke imødekomme din forudbetaling til <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5–10 hverdage.</p>
        <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
      `,
    }),
    text: renderEmailText({
      title: "Booking afvist — refundering på vej",
      lines: [
        `Hej ${opts.guestName},`,
        `Desværre kunne ejeren ikke imødekomme din forudbetaling til ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
        `Din betaling på ${opts.amountTotalDkk} kr refunderes inden for 5–10 hverdage.`,
      ],
      url: "https://shelterdk.dk/soeg",
    }),
  });
  if (error) throw new Error("Email-fejl (refundering gæst): " + JSON.stringify(error));
}
```

- [ ] **Step 5: sendGuestCancelledToGuest + sendGuestCancelledToOwner**

```typescript
export async function sendGuestCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  refundEligible: boolean;
  amountTotalDkk: number | null;
}) {
  const refundHtml = opts.refundEligible && opts.amountTotalDkk
    ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes inden for 5–10 hverdage.</p>`
    : opts.amountTotalDkk
      ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Betalingen på <strong>${opts.amountTotalDkk} kr</strong> refunderes ikke, da annulleringen sker inden for aflysningsfristen.</p>`
      : "";
  const refundText = opts.refundEligible && opts.amountTotalDkk
    ? `Din betaling på ${opts.amountTotalDkk} kr refunderes inden for 5–10 hverdage.`
    : opts.amountTotalDkk
      ? `Betalingen på ${opts.amountTotalDkk} kr refunderes ikke (inden for aflysningsfrist).`
      : "";

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er annulleret`,
    html: renderEmail({
      title: "Booking annulleret",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
        <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 10px;">Din booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er nu annulleret.</p>
        ${refundHtml}
        <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
      `,
    }),
    text: renderEmailText({
      title: "Booking annulleret",
      lines: [
        `Hej ${opts.guestName},`,
        `Din booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}) er nu annulleret.`,
        ...(refundText ? [refundText] : []),
      ],
      url: "https://shelterdk.dk/soeg",
    }),
  });
  if (error) throw new Error("Email-fejl (gæst annulleret til gæst): " + JSON.stringify(error));
}

export async function sendGuestCancelledToOwner(opts: {
  ownerEmail: string;
  ownerToken: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Booking annulleret af gæst: ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: "Booking annulleret af gæst",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> har annulleret sin booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Datoen er nu ledig igen.</p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Gå til dit dashboard</a>
      `,
    }),
    text: renderEmailText({
      title: "Booking annulleret af gæst",
      lines: [
        `${opts.guestName} har annulleret sin booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
        "Datoen er nu ledig igen.",
      ],
      url: dashboardUrl,
    }),
  });
  if (error) throw new Error("Email-fejl (gæst annulleret til ejer): " + JSON.stringify(error));
}
```

- [ ] **Step 6: Kør fuld testsuite**

```bash
cd web && npx vitest run
```

Forventet: Alle tests består.

- [ ] **Step 7: Commit**

```bash
git add web/lib/booking-email.ts
git commit -m "feat: update 8 simple booking email functions to new template + plain text

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: 7 komplekse booking email funktioner

**Filer:**
- Ændr: `web/lib/booking-email.ts`

**Særlige tilfælde:**
- `sendBookingAutoMessage`: bevarer `applyMessagePlaceholders()` + lokal `replacePlain()` — ændrer kun wrapperen
- `sendBookingRequestToOwner`: grøn/rød knap bevares med semantisk farve
- `sendPaymentConfirmed` + `sendBookingExpired`: to uafhængige `renderEmail()` / `renderEmailText()` kald pr. funktion

- [ ] **Step 1: sendOwnerCancelledToGuest + sendNewMessageToOwner + sendNewMessageToGuest**

```typescript
export async function sendOwnerCancelledToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number | null;
}) {
  const refundHtml = opts.amountTotalDkk
    ? `<p style="font-size:13px;color:#666;margin:0 0 16px;">Din betaling på <strong>${opts.amountTotalDkk} kr</strong> refunderes fuldt ud inden for 5–10 hverdage.</p>`
    : "";
  const refundText = opts.amountTotalDkk
    ? `Din betaling på ${opts.amountTotalDkk} kr refunderes fuldt ud inden for 5–10 hverdage.`
    : "";

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Din booking af ${esc(opts.shelterTitle)} er annulleret af ejeren`,
    html: renderEmail({
      title: "Booking annulleret af ejeren",
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
        <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 10px;">Desværre har ejeren annulleret din booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}).</p>
        ${refundHtml}
        <p style="font-size:13px;color:#666;margin:0 0 16px;">Vi beklager ulejligheden.</p>
        <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
      `,
    }),
    text: renderEmailText({
      title: "Booking annulleret af ejeren",
      lines: [
        `Hej ${opts.guestName},`,
        `Desværre har ejeren annulleret din booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
        ...(refundText ? [refundText] : []),
        "Vi beklager ulejligheden.",
      ],
      url: "https://shelterdk.dk/soeg",
    }),
  });
  if (error) throw new Error("Email-fejl (ejer annulleret til gæst): " + JSON.stringify(error));
}

export async function sendNewMessageToOwner(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  messageBody: string;
}) {
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Ny besked fra ${esc(opts.guestName)} – ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: `Ny besked fra ${opts.guestName}`,
      preheader: `${opts.guestName} har sendt en besked om ${opts.shelterTitle}.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;"><strong>${esc(opts.guestName)}</strong> har sendt en besked om <strong>${esc(opts.shelterTitle)}</strong>:</p>
        <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0 0 16px;padding:10px 14px;border-radius:0 6px 6px 0;">
          <p style="font-size:13px;color:#555;line-height:1.5;margin:0;font-style:italic;">${esc(opts.messageBody).replace(/\n/g, "<br>")}</p>
        </blockquote>
        <a href="${dashboardUrl}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Svar via dashboard</a>
      `,
    }),
    text: renderEmailText({
      title: `Ny besked fra ${opts.guestName}`,
      lines: [
        `${opts.guestName} har sendt en besked om ${opts.shelterTitle}:`,
        opts.messageBody,
      ],
      url: dashboardUrl,
    }),
  });
  if (error) throw new Error("Email-fejl (besked til ejer): " + JSON.stringify(error));
}

export async function sendNewMessageToGuest(opts: {
  guestEmail: string;
  guestName: string;
  shelterTitle: string;
  guestToken: string;
  messageBody: string;
}) {
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject: `Ny besked om din booking af ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: "Ny besked fra ejeren",
      preheader: `Ejeren af ${opts.shelterTitle} har sendt dig en besked.`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 12px;">Hej <strong>${esc(opts.guestName)}</strong>! Ejeren af <strong>${esc(opts.shelterTitle)}</strong> har sendt dig en besked:</p>
        <blockquote style="background:#f9f7f4;border-left:3px solid #c5a059;margin:0 0 16px;padding:10px 14px;border-radius:0 6px 6px 0;">
          <p style="font-size:13px;color:#555;line-height:1.5;margin:0;font-style:italic;">${esc(opts.messageBody).replace(/\n/g, "<br>")}</p>
        </blockquote>
        <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Svar via din booking</a>
      `,
    }),
    text: renderEmailText({
      title: "Ny besked fra ejeren",
      lines: [
        `Hej ${opts.guestName}! Ejeren af ${opts.shelterTitle} har sendt dig en besked:`,
        opts.messageBody,
      ],
      url: bookingLink(opts.guestToken),
    }),
  });
  if (error) throw new Error("Email-fejl (besked til gæst): " + JSON.stringify(error));
}
```

- [ ] **Step 2: sendBookingAutoMessage (placeholder-logik bevares)**

`applyMessagePlaceholders()` og lokal `replacePlain()` forbliver uændrede. Kun wrapperen skiftes.

```typescript
export async function sendBookingAutoMessage(opts: {
  guestEmail: string;
  subject: string;
  body: string;
  ctx: AutoMessageContext;
}) {
  function replacePlain(template: string): string {
    const nights = Math.max(
      1,
      Math.round(
        (new Date(opts.ctx.checkOut).getTime() - new Date(opts.ctx.checkIn).getTime()) /
          86_400_000
      )
    );
    function fmtDa(iso: string): string {
      return new Date(iso + "T12:00:00").toLocaleDateString("da-DK", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    }
    return template
      .replace(/{gæst_navn}/g, opts.ctx.guestName)
      .replace(/{shelter_navn}/g, opts.ctx.shelterTitle)
      .replace(/{ankomst_dato}/g, fmtDa(opts.ctx.checkIn))
      .replace(/{afrejse_dato}/g, fmtDa(opts.ctx.checkOut))
      .replace(/{antal_nætter}/g, String(nights))
      .replace(/{antal_personer}/g, String(opts.ctx.guestCount));
  }

  const subject = replacePlain(opts.subject);
  const bodyHtml = applyMessagePlaceholders(escapeHtml(opts.body), opts.ctx).replace(/\n/g, "<br>");
  const bodyPlain = replacePlain(opts.body);

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.guestEmail,
    subject,
    html: renderEmail({
      title: subject,
      bodyHtml: `<p style="font-size:13px;color:#333;line-height:1.65;">${bodyHtml}</p>`,
    }),
    text: renderEmailText({
      title: subject,
      lines: [bodyPlain],
    }),
  });

  if (error) {
    throw new Error("Email-fejl (auto-besked): " + JSON.stringify(error));
  }
}
```

- [ ] **Step 3: sendBookingRequestToOwner (grøn/rød knap bevares)**

Acceptér/afvis-knapperne beholder semantisk farve. `renderEmail()` wrapper header og footer; knapperne er del af `bodyHtml`.

```typescript
export async function sendBookingRequestToOwner(opts: {
  ownerEmail: string;
  shelterTitle: string;
  ownerToken: string;
  guestName: string;
  guestEmail: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  message: string | null;
  confirmToken: string;
  rejectToken: string;
}) {
  const confirmUrl = `${SITE_URL}/api/booking/action/${opts.confirmToken}`;
  const rejectUrl = `${SITE_URL}/api/booking/action/${opts.rejectToken}`;
  const dashboardUrl = `${SITE_URL}/owner/${opts.ownerToken}`;
  const messageBlock = opts.message
    ? `<div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
        <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Besked fra gæst</p>
        <p style="font-size:13px;color:#555;margin:0;">${esc(opts.message)}</p>
      </div>`
    : "";

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: opts.ownerEmail,
    subject: `Ny bookingforespørgsel til ${esc(opts.shelterTitle)}`,
    html: renderEmail({
      title: "Ny bookingforespørgsel",
      preheader: `${opts.guestName} ønsker at booke ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}).`,
      bodyHtml: `
        <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> (${esc(opts.guestEmail)}) ønsker at booke <strong>${esc(opts.shelterTitle)}</strong>.</p>
        <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
          <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer · ${opts.guestCount} person${opts.guestCount !== 1 ? "er" : ""}</p>
          <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
        </div>
        ${messageBlock}
        <div style="margin:20px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;margin-right:8px;">✓ Acceptér booking</a>
          <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">✗ Afvis booking</a>
        </div>
        <p style="font-size:12px;color:#999;margin:0;">Eller administrér via dit <a href="${dashboardUrl}" style="color:#c5a059;">dashboard</a>. Linkene udløber om 7 dage.</p>
      `,
    }),
    text: renderEmailText({
      title: "Ny bookingforespørgsel",
      lines: [
        `${opts.guestName} (${opts.guestEmail}) ønsker at booke ${opts.shelterTitle}.`,
        `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)} · ${opts.guestCount} person${opts.guestCount !== 1 ? "er" : ""}`,
        ...(opts.message ? [`Besked: ${opts.message}`] : []),
        `Acceptér: ${confirmUrl}`,
        `Afvis: ${rejectUrl}`,
      ],
      url: dashboardUrl,
    }),
  });
  if (error) throw new Error("Email-fejl (ejer forespørgsel): " + JSON.stringify(error));
}
```

- [ ] **Step 4: sendPaymentConfirmed (to uafhængige sends)**

```typescript
export async function sendPaymentConfirmed(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
  amountTotalDkk: number;
  guestToken: string;
}) {
  const resend = getResend();
  const [r1, r2] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.guestEmail,
      subject: "Betaling modtaget – booking bekræftet!",
      html: renderEmail({
        title: "Betaling modtaget – god tur!",
        preheader: `Din betaling på ${opts.amountTotalDkk} kr er modtaget. Din booking af ${opts.shelterTitle} er bekræftet.`,
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>! Vi har modtaget din betaling på <strong>${opts.amountTotalDkk} kr</strong>.</p>
          <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
            <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Bekræftet ophold</p>
            <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0 0 2px;">${esc(opts.shelterTitle)}</p>
            <p style="font-size:12px;color:#666;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
          </div>
          <p style="font-size:13px;color:#666;margin:0 0 16px;">Din booking er nu bekræftet. <strong>God tur!</strong></p>
          <a href="${bookingLink(opts.guestToken)}" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Se og administrér din booking</a>
        `,
      }),
      text: renderEmailText({
        title: "Betaling modtaget – god tur!",
        lines: [
          `Hej ${opts.guestName}! Vi har modtaget din betaling på ${opts.amountTotalDkk} kr.`,
          `${opts.shelterTitle} · ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
          "Din booking er nu bekræftet. God tur!",
        ],
        url: bookingLink(opts.guestToken),
      }),
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.ownerEmail,
      subject: `Betaling modtaget: ${esc(opts.shelterTitle)}`,
      html: renderEmail({
        title: "Betaling modtaget",
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;"><strong>${esc(opts.guestName)}</strong> har betalt <strong>${opts.amountTotalDkk} kr</strong> for <strong>${esc(opts.shelterTitle)}</strong>.</p>
          <div style="background:#f9f7f4;border-left:3px solid #c5a059;border-radius:0 6px 6px 0;padding:9px 13px;margin:12px 0;">
            <p style="font-size:10px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Datoer</p>
            <p style="font-size:13px;font-weight:600;color:#2C3E50;margin:0;">${esc(formatDate(opts.checkIn))} → ${esc(formatDate(opts.checkOut))}</p>
          </div>
        `,
      }),
      text: renderEmailText({
        title: "Betaling modtaget",
        lines: [
          `${opts.guestName} har betalt ${opts.amountTotalDkk} kr for ${opts.shelterTitle}.`,
          `Datoer: ${formatDate(opts.checkIn)} → ${formatDate(opts.checkOut)}`,
        ],
      }),
    }),
  ]);
  if (r1.error) throw new Error("Email-fejl (betaling gæst): " + JSON.stringify(r1.error));
  if (r2.error) throw new Error("Email-fejl (betaling ejer): " + JSON.stringify(r2.error));
}
```

- [ ] **Step 5: sendBookingExpired (to uafhængige sends)**

```typescript
export async function sendBookingExpired(opts: {
  guestEmail: string;
  guestName: string;
  ownerEmail: string;
  shelterTitle: string;
  checkIn: string;
  checkOut: string;
}) {
  const resend = getResend();
  const [r1, r2] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.guestEmail,
      subject: "Din booking er udløbet",
      html: renderEmail({
        title: "Din booking er udløbet",
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Hej <strong>${esc(opts.guestName)}</strong>,</p>
          <p style="font-size:13px;color:#666;line-height:1.65;margin:0 0 16px;">Din booking af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er desværre annulleret, da betalingsfristen på 24 timer ikke blev overholdt.</p>
          <a href="https://shelterdk.dk/soeg" style="display:inline-block;background:#c5a059;color:white;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;font-weight:600;">Find andre shelters</a>
        `,
      }),
      text: renderEmailText({
        title: "Din booking er udløbet",
        lines: [
          `Hej ${opts.guestName},`,
          `Din booking af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}) er annulleret, da betalingsfristen på 24 timer ikke blev overholdt.`,
        ],
        url: "https://shelterdk.dk/soeg",
      }),
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: opts.ownerEmail,
      subject: `Booking udløbet — dato er ledig igen`,
      html: renderEmail({
        title: "Booking udløbet",
        bodyHtml: `
          <p style="font-size:13px;color:#333;line-height:1.65;margin:0 0 10px;">Bookingen fra <strong>${esc(opts.guestName)}</strong> af <strong>${esc(opts.shelterTitle)}</strong> (${esc(formatDate(opts.checkIn))}–${esc(formatDate(opts.checkOut))}) er annulleret, da gæsten ikke betalte inden for 24 timer.</p>
          <p style="font-size:13px;color:#666;margin:0;">Datoen er ledig igen.</p>
        `,
      }),
      text: renderEmailText({
        title: "Booking udløbet",
        lines: [
          `Bookingen fra ${opts.guestName} af ${opts.shelterTitle} (${formatDate(opts.checkIn)}–${formatDate(opts.checkOut)}) er annulleret da gæsten ikke betalte inden for 24 timer.`,
          "Datoen er ledig igen.",
        ],
      }),
    }),
  ]);
  if (r1.error) throw new Error("Email-fejl (udløbet gæst): " + JSON.stringify(r1.error));
  if (r2.error) throw new Error("Email-fejl (udløbet ejer): " + JSON.stringify(r2.error));
}
```

- [ ] **Step 6: Kør fuld testsuite**

```bash
cd web && npx vitest run
```

Forventet: Alle tests består.

- [ ] **Step 7: Commit**

```bash
git add web/lib/booking-email.ts
git commit -m "feat: update all 15 booking email functions to new template + plain text

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
