// web/app/api/__tests__/submit-shelter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase admin client
const mockInsert = vi.fn();
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

// Import after mocks
const { POST } = await import("../submit-shelter/route");

// Use unique IPs to avoid hitting the in-memory rate limiter between tests
let _ipCounter = 0;
function makeRequest(body: unknown, ip?: string): Request {
  return new Request("http://localhost/api/submit-shelter", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip ?? `10.0.${Math.floor(_ipCounter / 254)}.${(_ipCounter++ % 254) + 1}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/submit-shelter", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("returnerer 400 hvis type mangler", async () => {
    const res = await POST(makeRequest({ shelter_name: "Test", location_text: "Aarhus" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("type");
  });

  it("returnerer 400 hvis shelter_name mangler", async () => {
    const res = await POST(makeRequest({ type: "user_tip", location_text: "Aarhus" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returnerer 400 hvis location_text mangler", async () => {
    const res = await POST(makeRequest({ type: "user_tip", shelter_name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 ved owner_registration uden contact_email", async () => {
    const res = await POST(makeRequest({
      type: "owner_registration",
      shelter_name: "Test Shelter",
      location_text: "Vejle",
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it("returnerer 400 ved ugyldig email-format", async () => {
    const res = await POST(makeRequest({
      type: "owner_registration",
      shelter_name: "Test",
      location_text: "Vejle",
      contact_email: "not-an-email",
    }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 hvis source_info er over 500 tegn", async () => {
    const res = await POST(makeRequest({
      type: "user_tip",
      shelter_name: "Test",
      location_text: "Aarhus",
      source_info: "x".repeat(501),
    }));
    expect(res.status).toBe(400);
  });

  it("returnerer 201 ved gyldigt user_tip", async () => {
    const res = await POST(makeRequest({
      type: "user_tip",
      shelter_name: "Shelter ved søen",
      location_text: "Silkeborg",
      source_info: "Har overnattet der to gange",
    }));
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("returnerer 201 ved gyldigt owner_registration", async () => {
    const res = await POST(makeRequest({
      type: "owner_registration",
      shelter_name: "Naturhytten",
      location_text: "Skanderborg",
      contact_email: "ejer@naturhytten.dk",
      capacity: 6,
      facilities: { vand: true, baalplads: true },
    }));
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("ignorerer ukendte fields i facilities", async () => {
    const res = await POST(makeRequest({
      type: "user_tip",
      shelter_name: "Test",
      location_text: "København",
    }));
    expect(res.status).toBe(201);
  });

  it("returnerer 400 ved ugyldig JSON", async () => {
    const req = makeRequest("not json");
    // Override body after construction to send invalid JSON
    const badReq = new Request("http://localhost/api/submit-shelter", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${_ipCounter++}` },
      body: "not json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
