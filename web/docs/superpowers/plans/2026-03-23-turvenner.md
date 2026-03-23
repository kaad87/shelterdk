# Find Turvenner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/turvenner` page where users can post and browse trip companion requests for shelter trips, with email-based contact and automatic expiry.

**Architecture:** Next.js App Router page with client component for interactivity. Supabase `trip_posts` table with RLS. API routes for CRUD + contact email via Resend. Spam protection via honeypot + rate limiting + basic content filter.

**Tech Stack:** Next.js 14, Supabase, Resend (email), Tailwind CSS, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-23-turvenner-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/turvenner.ts` | Types, validation, spam filter, region list |
| `app/api/turvenner/route.ts` | GET (list) + POST (create) |
| `app/api/turvenner/[slug]/contact/route.ts` | POST (send contact email) |
| `app/api/turvenner/[slug]/report/route.ts` | POST (report post) |
| `components/TurvennerClient.tsx` | Main client component: list + create + contact modals |
| `components/TripPostCard.tsx` | Individual post card |
| `app/(site)/turvenner/page.tsx` | Server page with metadata |
| `lib/email.ts` | Resend email helper |
| `components/Navbar.tsx` | Add nav link (modify) |

---

### Task 1: Install Resend + Create Database Table

**Files:**
- Modify: `package.json` (add resend dependency)
- Create: `supabase-migration.sql` (reference only, execute in Supabase dashboard)

- [ ] **Step 1: Install Resend**

```bash
cd /Users/CKA/shelterdk/web && npm install resend
```

- [ ] **Step 2: Create trip_posts table in Supabase**

Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor):

```sql
CREATE TABLE trip_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  author_name text NOT NULL,
  author_email text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  trip_date date,
  spots_available integer NOT NULL DEFAULT 1,
  region text NOT NULL,
  shelter_id uuid REFERENCES shelters(id),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  report_count integer NOT NULL DEFAULT 0,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_posts_active ON trip_posts (status, expires_at DESC) WHERE status = 'active';
CREATE INDEX idx_trip_posts_region ON trip_posts (region) WHERE status = 'active';
CREATE INDEX idx_trip_posts_ip_hash ON trip_posts (ip_hash, created_at);

-- RLS
ALTER TABLE trip_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active posts"
  ON trip_posts FOR SELECT
  USING (status = 'active' AND expires_at > now());

CREATE POLICY "Anyone can insert posts"
  ON trip_posts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update report_count"
  ON trip_posts FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 3: Add RESEND_API_KEY to .env.local**

```bash
echo 'RESEND_API_KEY=re_xxxx' >> /Users/CKA/shelterdk/web/.env.local
```

(User must replace `re_xxxx` with actual Resend API key from resend.com)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(turvenner): install resend dependency"
```

---

### Task 2: Shared Library — Types, Validation, Spam Filter

**Files:**
- Create: `lib/turvenner.ts`

- [ ] **Step 1: Create lib/turvenner.ts**

```typescript
// lib/turvenner.ts

export interface TripPost {
  id: string;
  slug: string;
  author_name: string;
  title: string;
  description: string;
  trip_date: string | null;
  spots_available: number;
  region: string;
  shelter_id: string | null;
  expires_at: string;
  status: string;
  created_at: string;
}

export interface CreateTripPostInput {
  author_name: string;
  author_email: string;
  title: string;
  description: string;
  trip_date?: string;
  spots_available: number;
  region: string;
  shelter_id?: string;
  honeypot?: string;
}

export interface ContactInput {
  sender_name: string;
  sender_email: string;
  message: string;
  honeypot?: string;
}

export const REGIONS = [
  "Nordjylland",
  "Midtjylland",
  "Sønderjylland",
  "Vestjylland",
  "Østjylland",
  "Fyn",
  "Nordsjælland",
  "Sydsjælland",
  "Vestsjælland",
  "Lolland-Falster",
  "Bornholm",
  "Hovedstaden",
] as const;

export type Region = (typeof REGIONS)[number];

const BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.com\b/i,
  /\.dk\b/i,
  /køb\s/i,
  /gratis\s.*penge/i,
  /viagra/i,
  /casino/i,
  /crypto/i,
];

export function isSpam(text: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(text));
}

export function validateCreateInput(
  input: Partial<CreateTripPostInput>
): string | null {
  if (input.honeypot) return "spam";

  const name = input.author_name?.trim();
  if (!name || name.length < 2 || name.length > 60)
    return "Navn skal være mellem 2 og 60 tegn.";

  const email = input.author_email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Ugyldig email.";

  const title = input.title?.trim();
  if (!title || title.length < 5 || title.length > 100)
    return "Titel skal være mellem 5 og 100 tegn.";

  const desc = input.description?.trim();
  if (!desc || desc.length < 10 || desc.length > 500)
    return "Beskrivelse skal være mellem 10 og 500 tegn.";

  if (isSpam(title) || isSpam(desc))
    return "Opslaget indeholder ikke-tilladt indhold.";

  const spots = input.spots_available;
  if (!spots || spots < 1 || spots > 10)
    return "Antal pladser skal være mellem 1 og 10.";

  const region = input.region;
  if (!region || !REGIONS.includes(region as Region))
    return "Vælg en gyldig region.";

  if (input.trip_date) {
    const d = new Date(input.trip_date);
    if (isNaN(d.getTime())) return "Ugyldig dato.";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return "Turdato kan ikke være i fortiden.";
  }

  return null;
}

export function validateContactInput(
  input: Partial<ContactInput>
): string | null {
  if (input.honeypot) return "spam";

  const name = input.sender_name?.trim();
  if (!name || name.length < 2 || name.length > 60)
    return "Navn skal være mellem 2 og 60 tegn.";

  const email = input.sender_email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Ugyldig email.";

  const msg = input.message?.trim();
  if (!msg || msg.length < 10 || msg.length > 1000)
    return "Besked skal være mellem 10 og 1000 tegn.";

  if (isSpam(msg)) return "Beskeden indeholder ikke-tilladt indhold.";

  return null;
}

export function generateSlug(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function computeExpiresAt(tripDate?: string): string {
  if (tripDate) {
    const d = new Date(tripDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/turvenner.ts
git commit -m "feat(turvenner): add types, validation, and spam filter"
```

---

### Task 3: Email Helper

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Create lib/email.ts**

```typescript
// lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "ShelterDK <onboarding@resend.dev>";

export async function sendContactEmail(opts: {
  toEmail: string;
  toName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  postTitle: string;
}) {
  const { toEmail, toName, senderName, senderEmail, message, postTitle } = opts;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: senderEmail,
    subject: `Ny besked om dit opslag: ${postTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #2C3E50;">Hej ${toName}!</h2>
        <p>Du har fået en besked om dit opslag <strong>"${postTitle}"</strong> på ShelterDK.</p>
        <hr style="border: 1px solid #eee;" />
        <p><strong>Fra:</strong> ${senderName} (${senderEmail})</p>
        <p><strong>Besked:</strong></p>
        <p style="background: #f9f9f9; padding: 12px; border-radius: 8px;">${message.replace(/\n/g, "<br>")}</p>
        <hr style="border: 1px solid #eee;" />
        <p style="color: #666; font-size: 14px;">Du kan svare direkte på denne email for at kontakte ${senderName}.</p>
        <p style="color: #999; font-size: 12px;">Denne email er sendt via <a href="https://shelterdk.dk/turvenner">ShelterDK Turvenner</a></p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error("Kunne ikke sende email.");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/email.ts
git commit -m "feat(turvenner): add Resend email helper"
```

---

### Task 4: API Routes — List + Create Posts

**Files:**
- Create: `app/api/turvenner/route.ts`

- [ ] **Step 1: Create app/api/turvenner/route.ts**

```typescript
// app/api/turvenner/route.ts
import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";
import {
  validateCreateInput,
  generateSlug,
  computeExpiresAt,
  REGIONS,
  type CreateTripPostInput,
} from "@/lib/turvenner";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/turvenner?region=Nordjylland
 */
export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") || "";
  const supabase = createPublicClient();

  let query = supabase
    .from("trip_posts")
    .select("id, slug, author_name, title, description, trip_date, spots_available, region, shelter_id, expires_at, created_at")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (region && REGIONS.includes(region as any)) {
    query = query.eq("region", region);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Trip posts fetch error:", error);
    return Response.json({ error: "Kunne ikke hente opslag." }, { status: 500 });
  }

  return Response.json(data || []);
}

/**
 * POST /api/turvenner
 * Body: CreateTripPostInput
 */
export async function POST(request: NextRequest) {
  let body: Partial<CreateTripPostInput>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const validationError = validateCreateInput(body);
  if (validationError) {
    if (validationError === "spam") {
      return Response.json({ ok: true, message: "Tak! Dit opslag er oprettet." });
    }
    return Response.json({ error: validationError }, { status: 400 });
  }

  // Rate limiting: max 3 posts per IP per day
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  const supabase = createPublicClient();

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { count } = await supabase
    .from("trip_posts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneDayAgo.toISOString());

  if ((count ?? 0) >= 3) {
    return Response.json(
      { error: "Du kan maksimalt oprette 3 opslag per dag." },
      { status: 429 }
    );
  }

  const slug = generateSlug();
  const expiresAt = computeExpiresAt(body.trip_date);

  const { error } = await supabase.from("trip_posts").insert({
    slug,
    author_name: body.author_name!.trim(),
    author_email: body.author_email!.trim(),
    title: body.title!.trim(),
    description: body.description!.trim(),
    trip_date: body.trip_date || null,
    spots_available: body.spots_available!,
    region: body.region!,
    shelter_id: body.shelter_id || null,
    expires_at: expiresAt,
    status: "active",
    ip_hash: ipHash,
  });

  if (error) {
    console.error("Trip post insert error:", error);
    return Response.json({ error: "Kunne ikke oprette opslag. Prøv igen." }, { status: 500 });
  }

  return Response.json({ ok: true, message: "Dit opslag er nu live!", slug });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/turvenner/route.ts
git commit -m "feat(turvenner): add GET/POST API routes for trip posts"
```

---

### Task 5: API Routes — Contact + Report

**Files:**
- Create: `app/api/turvenner/[slug]/contact/route.ts`
- Create: `app/api/turvenner/[slug]/report/route.ts`

- [ ] **Step 1: Create contact route**

```typescript
// app/api/turvenner/[slug]/contact/route.ts
import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";
import { validateContactInput, type ContactInput } from "@/lib/turvenner";
import { sendContactEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/turvenner/[slug]/contact
 * Body: { sender_name, sender_email, message, honeypot? }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  let body: Partial<ContactInput>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const validationError = validateContactInput(body);
  if (validationError) {
    if (validationError === "spam") {
      return Response.json({ ok: true, message: "Besked sendt!" });
    }
    return Response.json({ error: validationError }, { status: 400 });
  }

  const supabase = createPublicClient();
  const { data: post, error: postError } = await supabase
    .from("trip_posts")
    .select("author_name, author_email, title, status, expires_at")
    .eq("slug", slug)
    .single();

  if (postError || !post) {
    return Response.json({ error: "Opslag ikke fundet." }, { status: 404 });
  }

  if (post.status !== "active" || new Date(post.expires_at) < new Date()) {
    return Response.json({ error: "Opslaget er udløbet." }, { status: 410 });
  }

  try {
    await sendContactEmail({
      toEmail: post.author_email,
      toName: post.author_name,
      senderName: body.sender_name!.trim(),
      senderEmail: body.sender_email!.trim(),
      message: body.message!.trim(),
      postTitle: post.title,
    });
  } catch {
    return Response.json({ error: "Kunne ikke sende besked. Prøv igen." }, { status: 500 });
  }

  return Response.json({ ok: true, message: "Din besked er sendt!" });
}
```

- [ ] **Step 2: Create report route**

```typescript
// app/api/turvenner/[slug]/report/route.ts
import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

/**
 * POST /api/turvenner/[slug]/report
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabase = createPublicClient();

  const { data: post, error: fetchError } = await supabase
    .from("trip_posts")
    .select("id, report_count")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (fetchError || !post) {
    return Response.json({ error: "Opslag ikke fundet." }, { status: 404 });
  }

  const newCount = (post.report_count || 0) + 1;
  const newStatus = newCount >= 3 ? "removed" : "active";

  await supabase
    .from("trip_posts")
    .update({ report_count: newCount, status: newStatus })
    .eq("id", post.id);

  return Response.json({ ok: true, message: "Tak for din rapportering." });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/turvenner/[slug]/contact/route.ts app/api/turvenner/[slug]/report/route.ts
git commit -m "feat(turvenner): add contact email and report API routes"
```

---

### Task 6: TripPostCard Component

**Files:**
- Create: `components/TripPostCard.tsx`

- [ ] **Step 1: Create TripPostCard.tsx**

```typescript
// components/TripPostCard.tsx
"use client";

import { Calendar, Users, MapPin } from "lucide-react";
import type { TripPost } from "@/lib/turvenner";

interface Props {
  post: TripPost;
  onContact: (post: TripPost) => void;
  onReport: (post: TripPost) => void;
}

export function TripPostCard({ post, onContact, onReport }: Props) {
  const tripDateStr = post.trip_date
    ? new Date(post.trip_date).toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const createdStr = new Date(post.created_at).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="rounded-xl border border-primary/10 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-serif text-lg font-semibold text-primary leading-tight">
          {post.title}
        </h3>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          <Users size={13} />
          {post.spots_available} {post.spots_available === 1 ? "plads" : "pladser"}
        </span>
      </div>

      <p className="text-sm text-primary/70 mb-3 line-clamp-3">
        {post.description}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary/50 mb-4">
        <span className="inline-flex items-center gap-1">
          <MapPin size={13} />
          {post.region}
        </span>
        {tripDateStr && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={13} />
            {tripDateStr}
          </span>
        )}
        <span>Af {post.author_name} · {createdStr}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onContact(post)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          Kontakt
        </button>
        <button
          onClick={() => onReport(post)}
          className="text-xs text-primary/30 hover:text-red-500 transition-colors ml-auto"
        >
          Rapportér
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TripPostCard.tsx
git commit -m "feat(turvenner): add TripPostCard component"
```

---

### Task 7: TurvennerClient Component

**Files:**
- Create: `components/TurvennerClient.tsx`

- [ ] **Step 1: Create TurvennerClient.tsx**

```typescript
// components/TurvennerClient.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Send, AlertTriangle } from "lucide-react";
import { TripPostCard } from "./TripPostCard";
import {
  type TripPost,
  type Region,
  REGIONS,
} from "@/lib/turvenner";

export function TurvennerClient() {
  const [posts, setPosts] = useState<TripPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    author_name: "",
    author_email: "",
    title: "",
    description: "",
    trip_date: "",
    spots_available: 1,
    region: "" as string,
    honeypot: "",
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Contact modal
  const [contactPost, setContactPost] = useState<TripPost | null>(null);
  const [contactForm, setContactForm] = useState({
    sender_name: "",
    sender_email: "",
    message: "",
    honeypot: "",
  });
  const [sending, setSending] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = region ? `?region=${encodeURIComponent(region)}` : "";
      const res = await fetch(`/api/turvenner${params}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    try {
      const res = await fetch("/api/turvenner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          trip_date: createForm.trip_date || undefined,
          spots_available: Number(createForm.spots_available),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateMsg({ ok: false, text: data.error || "Noget gik galt." });
        return;
      }
      setCreateMsg({ ok: true, text: data.message || "Opslag oprettet!" });
      setCreateForm({
        author_name: "",
        author_email: "",
        title: "",
        description: "",
        trip_date: "",
        spots_available: 1,
        region: "",
        honeypot: "",
      });
      setTimeout(() => {
        setShowCreate(false);
        setCreateMsg(null);
        fetchPosts();
      }, 1500);
    } catch {
      setCreateMsg({ ok: false, text: "Kunne ikke oprette opslag. Prøv igen." });
    } finally {
      setCreating(false);
    }
  }

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactPost) return;
    setContactMsg(null);
    setSending(true);
    try {
      const res = await fetch(`/api/turvenner/${contactPost.slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactMsg({ ok: false, text: data.error || "Noget gik galt." });
        return;
      }
      setContactMsg({ ok: true, text: data.message || "Besked sendt!" });
      setTimeout(() => {
        setContactPost(null);
        setContactMsg(null);
        setContactForm({ sender_name: "", sender_email: "", message: "", honeypot: "" });
      }, 2000);
    } catch {
      setContactMsg({ ok: false, text: "Kunne ikke sende besked. Prøv igen." });
    } finally {
      setSending(false);
    }
  }

  async function handleReport(post: TripPost) {
    if (!confirm("Er du sikker på du vil rapportere dette opslag?")) return;
    await fetch(`/api/turvenner/${post.slug}/report`, { method: "POST" });
    fetchPosts();
  }

  const inputClass =
    "w-full rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";
  const labelClass = "block text-sm font-medium text-primary/70 mb-1";

  return (
    <div>
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary bg-white"
            aria-label="Filtrer efter region"
          >
            <option value="">Alle regioner</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-sm text-primary/40">
            {posts.length} {posts.length === 1 ? "opslag" : "opslag"}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          Opret opslag
        </button>
      </div>

      {/* Post list */}
      {loading ? (
        <div className="text-center py-12 text-primary/30 text-sm">Indlæser opslag...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary/40 mb-2">Ingen opslag endnu</p>
          <p className="text-primary/30 text-sm">Vær den første til at oprette et opslag!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <TripPostCard
              key={post.id}
              post={post}
              onContact={setContactPost}
              onReport={handleReport}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-primary">Opret opslag</h2>
              <button onClick={() => { setShowCreate(false); setCreateMsg(null); }} className="text-primary/40 hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                value={createForm.honeypot}
                onChange={(e) => setCreateForm({ ...createForm, honeypot: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />
              <div>
                <label className={labelClass}>Navn *</label>
                <input type="text" required value={createForm.author_name} onChange={(e) => setCreateForm({ ...createForm, author_name: e.target.value })} className={inputClass} placeholder="Dit navn" />
              </div>
              <div>
                <label className={labelClass}>Email * <span className="text-primary/30 font-normal">(vises ikke)</span></label>
                <input type="email" required value={createForm.author_email} onChange={(e) => setCreateForm({ ...createForm, author_email: e.target.value })} className={inputClass} placeholder="din@email.dk" />
              </div>
              <div>
                <label className={labelClass}>Titel *</label>
                <input type="text" required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className={inputClass} placeholder="Fx: Weekendtur til Langeland" />
              </div>
              <div>
                <label className={labelClass}>Beskrivelse *</label>
                <textarea required value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className={`${inputClass} min-h-[80px]`} placeholder="Beskriv din tur og hvem du leder efter..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Turdato</label>
                  <input type="date" value={createForm.trip_date} onChange={(e) => setCreateForm({ ...createForm, trip_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ledige pladser</label>
                  <select value={createForm.spots_available} onChange={(e) => setCreateForm({ ...createForm, spots_available: Number(e.target.value) })} className={inputClass}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Region *</label>
                <select required value={createForm.region} onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })} className={inputClass}>
                  <option value="">Vælg region</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {createMsg && (
                <p className={`text-sm ${createMsg.ok ? "text-green-600" : "text-red-500"}`}>{createMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {creating ? "Opretter..." : "Opret opslag"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Contact modal */}
      {contactPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-bold text-primary">Kontakt {contactPost.author_name}</h2>
              <button onClick={() => { setContactPost(null); setContactMsg(null); }} className="text-primary/40 hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-primary/50 mb-4">
              Angående: <span className="font-medium text-primary/70">{contactPost.title}</span>
            </p>
            <form onSubmit={handleContact} className="space-y-3">
              <input
                type="text"
                name="website"
                value={contactForm.honeypot}
                onChange={(e) => setContactForm({ ...contactForm, honeypot: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />
              <div>
                <label className={labelClass}>Dit navn *</label>
                <input type="text" required value={contactForm.sender_name} onChange={(e) => setContactForm({ ...contactForm, sender_name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Din email *</label>
                <input type="email" required value={contactForm.sender_email} onChange={(e) => setContactForm({ ...contactForm, sender_email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Besked *</label>
                <textarea required value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} className={`${inputClass} min-h-[100px]`} placeholder="Skriv din besked her..." />
              </div>
              {contactMsg && (
                <p className={`text-sm ${contactMsg.ok ? "text-green-600" : "text-red-500"}`}>{contactMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={sending}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                <Send size={14} />
                {sending ? "Sender..." : "Send besked"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TurvennerClient.tsx
git commit -m "feat(turvenner): add main client component with list, create and contact modals"
```

---

### Task 8: Server Page + Navigation

**Files:**
- Create: `app/(site)/turvenner/page.tsx`
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
// app/(site)/turvenner/page.tsx
import type { Metadata } from "next";
import { TurvennerClient } from "@/components/TurvennerClient";

export const metadata: Metadata = {
  title: "Find Turvenner — ShelterDK",
  description:
    "Find makkere til din næste sheltertur. Opret et opslag eller kontakt andre shelter-entusiaster.",
  alternates: { canonical: "https://shelterdk.dk/turvenner" },
  openGraph: {
    title: "Find Turvenner — ShelterDK",
    description:
      "Find makkere til din næste sheltertur. Opret et opslag eller kontakt andre shelter-entusiaster.",
    url: "/turvenner",
  },
};

export default function TurvennerPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-2">
            Find turvenner
          </h1>
          <p className="text-primary/50 text-sm sm:text-base">
            Leder du efter nogen at dele en sheltertur med? Opret et opslag eller
            tag med på andres ture.
          </p>
        </div>
        <TurvennerClient />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add nav link in Navbar.tsx**

Find the `navLinks` array in `components/Navbar.tsx` and add after "Ruteplanner":

```typescript
  { label: "Turvenner", href: "/turvenner" },
```

So it becomes:
```typescript
  { label: "Ruteplanner", href: "/ruteplanner" },
  { label: "Turvenner", href: "/turvenner" },
  { label: "FAQ", href: "/faq" },
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/CKA/shelterdk/web && npx next build
```

Expected: Build succeeds with `/turvenner` listed as a static page.

- [ ] **Step 4: Commit**

```bash
git add app/\(site\)/turvenner/page.tsx components/Navbar.tsx
git commit -m "feat(turvenner): add server page with metadata and nav link"
```

---

### Task 9: Add RESEND_API_KEY to Netlify + Deploy

- [ ] **Step 1: Set env var on Netlify**

User must add `RESEND_API_KEY` in Netlify dashboard → Site configuration → Environment variables.

- [ ] **Step 2: Push to production**

```bash
git push
```

- [ ] **Step 3: Verify on production**

Visit `https://shelterdk.dk/turvenner` and verify:
- Page loads with header and empty state
- "Opret opslag" button opens modal
- Creating a post works and appears in the list
- "Kontakt" button opens contact modal
- Region filter works
