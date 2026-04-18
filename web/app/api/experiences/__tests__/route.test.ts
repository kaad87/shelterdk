import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/supabase/server-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/utils/supabase/server-public", () => ({ createPublicClient: vi.fn() }));

import { createAdminClient } from "@/utils/supabase/server-admin";
import { createPublicClient } from "@/utils/supabase/server-public";
import { POST, GET } from "../route";

function makePost(body: unknown) {
  return new Request("http://localhost/api/experiences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/experiences");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url);
}

const validPayload = {
  experienceId: "00000000-0000-0000-0000-000000000001",
  shelter_id: "00000000-0000-0000-0000-000000000002",
  author_name: "Allan",
  body: "Fantastisk tur!",
  photo_paths: ["00000000-0000-0000-0000-000000000001/0.webp"],
  cover_photo_index: 0,
};

describe("POST /api/experiences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields missing", async () => {
    const res = await POST(makePost({ shelter_id: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when author_name too long", async () => {
    const res = await POST(makePost({ ...validPayload, author_name: "a".repeat(61) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body too long", async () => {
    const res = await POST(makePost({ ...validPayload, body: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("inserts experience and returns 201", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    } as ReturnType<typeof createAdminClient>);

    const res = await POST(makePost(validPayload));
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});

describe("GET /api/experiences", () => {
  it("returns 400 without shelter_id", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });

  it("returns experiences array", async () => {
    const fakeData = [{ id: "1", author_name: "Allan", body: "Test", photo_urls: [], cover_photo_index: 0, created_at: "2025-01-01" }];
    vi.mocked(createPublicClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: fakeData, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as ReturnType<typeof createPublicClient>);

    const res = await GET(makeGet({ shelter_id: "abc" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.experiences).toHaveLength(1);
  });
});
