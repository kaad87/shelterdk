import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function normalizeEmail(raw: string | null | undefined): string | null {
  const e = raw?.trim().toLowerCase();
  return e && e.length > 0 ? e : null;
}

async function deleteSubscriber(email: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("newsletter_subscribers").delete().eq("email", email);
  } catch {
    // Stille fejl — afmelding må aldrig fejle synligt for brugeren.
  }
}

/**
 * POST: afmelding. Email læses fra JSON-body ELLER query-param (?email=).
 * Query-param-varianten understøtter RFC 8058 List-Unsubscribe-Post (one-click),
 * hvor mailbox-udbyderen POSTer til List-Unsubscribe-URL'en uden JSON-body.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let email = normalizeEmail(url.searchParams.get("email"));

  if (!email) {
    try {
      const body: { email?: string } = await request.json();
      email = normalizeEmail(body.email);
    } catch {
      // ingen body — falder igennem
    }
  }

  if (!email) {
    return Response.json({ error: "Mangler email" }, { status: 400 });
  }

  await deleteSubscriber(email);
  return Response.json({ ok: true });
}

/**
 * GET: menneske-venlig afmeldings-side. Sletter IKKE ved load (så e-mail-scannere
 * der pre-fetcher links ikke afmelder folk ved et uheld) — viser en bekræft-knap
 * der POSTer til samme URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("email"));

  const escaped = email ? email.replace(/[<>&"]/g, "") : "";
  const action = `/api/newsletter/unsubscribe?email=${encodeURIComponent(email ?? "")}`;

  const body = email
    ? `
      <h1>Afmeld nyhedsbrev</h1>
      <p>Vil du afmelde <strong>${escaped}</strong> fra ShelterDK's nyhedsbrev?</p>
      <form method="post" action="${action}">
        <button type="submit">Ja, afmeld mig</button>
      </form>
      <p class="muted">Du kan altid tilmelde dig igen senere.</p>`
    : `
      <h1>Afmeld nyhedsbrev</h1>
      <p>Linket mangler en e-mailadresse. Brug afmeldings-linket fra en af vores mails.</p>`;

  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Afmeld nyhedsbrev — ShelterDK</title>
    <style>
      body{font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2C3E50;max-width:520px;margin:0 auto;padding:48px 24px;line-height:1.6}
      h1{font-family:Georgia,serif;font-size:24px}
      button{background:#8A6A26;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer}
      button:hover{opacity:.92}
      .muted{color:#666;font-size:13px;margin-top:24px}
    </style></head>
    <body>${body}
    <script>
      document.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        try { await fetch(form.action, { method: 'POST' }); } catch (_) {}
        document.body.innerHTML = '<h1>Du er afmeldt</h1><p>Du modtager ikke flere nyhedsbreve fra ShelterDK. Tak fordi du kiggede forbi.</p>';
      });
    </script>
    </body></html>`;

  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
