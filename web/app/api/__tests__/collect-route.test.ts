import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../collect/route";

let fetchCalls: { url: string; body: unknown }[] = [];

function parseCookies(cookieHeader: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [key, ...v] = part.trim().split("=");
    if (key) m.set(key, v.join("=").trim());
  }
  return m;
}

beforeEach(() => {
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("google-analytics.com")) {
        fetchCalls.push({
          url,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        });
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    })
  );
});

function mockRequest(
  opts: { cookie?: string; body?: { path?: string; title?: string }; host?: string } = {}
): Request & { cookies: { get: (name: string) => { value: string } | undefined } } {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.host) headers.set("host", opts.host);
  const req = new Request("https://shelterdk.dk/api/collect", {
    method: "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }) as Request & { cookies: { get: (name: string) => { value: string } | undefined } };
  const cookiesMap = opts.cookie ? parseCookies(opts.cookie) : new Map<string, string>();
  req.cookies = {
    get: (name: string) => {
      const v = cookiesMap.get(name);
      return v !== undefined ? { value: v } : undefined;
    },
  };
  return req;
}

describe("POST /api/collect", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
    process.env.GA4_MEASUREMENT_ID = "G-TEST123";
    process.env.GA4_API_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = env;
  });

  it("returnerer 204 uden at kalde GA4 når consent er accept", async () => {
    const req = mockRequest({ cookie: "shelterdk_consent=accept" });
    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(0);
  });

  it("returnerer 204 uden at kalde GA4 når GA4-variabler mangler", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
    const req = mockRequest({ cookie: "shelterdk_consent=necessary", body: { path: "/soeg" } });
    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(0);
  });

  it("sender page_view til GA4 når consent er necessary og GA4 er konfigureret", async () => {
    const req = mockRequest({
      cookie: "shelterdk_consent=necessary",
      body: { path: "/soeg", title: "Søg shelters" },
      host: "shelterdk.dk",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("measurement_id=G-TEST123");
    expect(fetchCalls[0].url).toContain("api_secret=test-secret");
    const body = fetchCalls[0].body as { client_id: string; events: unknown[] };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      name: "page_view",
      params: {
        page_location: "https://shelterdk.dk/soeg",
        page_title: "Søg shelters",
        engagement_time_msec: 100,
      },
    });
    expect(body.client_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("sender page_view når cookie mangler (ny besøgende)", async () => {
    const req = mockRequest({ body: { path: "/faq" }, host: "shelterdk.dk" });
    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(1);
    const body = fetchCalls[0].body as { events: unknown[] };
    expect(body.events[0]).toMatchObject({
      params: { page_location: "https://shelterdk.dk/faq" },
    });
  });

  it("bruger path / ved tom eller ugyldig body", async () => {
    const req = mockRequest({ body: {}, host: "shelterdk.dk" });
    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(1);
    const body = fetchCalls[0].body as { events: unknown[] };
    expect(body.events[0]).toMatchObject({
      params: { page_location: "https://shelterdk.dk/" },
    });
  });

  it("afkorter title til 100 tegn", async () => {
    const longTitle = "a".repeat(150);
    const req = mockRequest({
      cookie: "shelterdk_consent=necessary",
      body: { path: "/", title: longTitle },
      host: "shelterdk.dk",
    });
    await POST(req as never);
    const body = fetchCalls[0].body as { events: unknown[] };
    expect((body.events[0] as { params: { page_title: string } }).params.page_title).toHaveLength(
      100
    );
  });
});
