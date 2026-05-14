// web/app/api/__tests__/activate-booking.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({
  sendBookingActivationEmails: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import("../activate-booking/route");
const { ipTimestamps } = await import("../activate-booking/_store");

function req(body: unknown): Request {
  return new Request("http://localhost/api/activate-booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  name: "Christian Kaad",
  organisation: "Geopark Odsherred",
  email: "christian@example.dk",
  shelterName: "Skovhytten",
};

describe("POST /api/activate-booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipTimestamps.clear(); // reset rate limiter between tests
  });

  it("returnerer 400 uden navn", async () => {
    const res = await POST(req({ ...VALID, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden organisation", async () => {
    const res = await POST(req({ ...VALID, organisation: "" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 med ugyldig email", async () => {
    const res = await POST(req({ ...VALID, email: "notanemail" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 uden shelterName", async () => {
    const res = await POST(req({ ...VALID, shelterName: "" }));
    expect(res.status).toBe(400);
  });

  it("returnerer 400 hvis besked er over 1000 tegn", async () => {
    const res = await POST(req({ ...VALID, message: "x".repeat(1001) }));
    expect(res.status).toBe(400);
  });

  it("returnerer 201 ved gyldigt request", async () => {
    const res = await POST(req(VALID));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("sender emails ved gyldigt request", async () => {
    const { sendBookingActivationEmails } = await import("@/lib/email");
    await POST(req(VALID));
    expect(sendBookingActivationEmails).toHaveBeenCalledWith(
      expect.objectContaining({ email: "christian@example.dk", shelterName: "Skovhytten" })
    );
  });

  it("returnerer 201 med valgfri besked", async () => {
    const res = await POST(req({ ...VALID, message: "Hurtigst muligt tak" }));
    expect(res.status).toBe(201);
  });
});
