import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../track/route";

let fetchCalls: { url: string; body: unknown }[] = [];

function parseCookies(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key) map.set(key, valueParts.join("=").trim());
  }
  return map;
}

function mockRequest(
  opts: {
    cookie?: string;
    body?: {
      event?: string;
      params?: Record<string, unknown>;
      path?: string;
      title?: string;
      referrer?: string;
    };
    host?: string;
  } = {}
): Request & { cookies: { get: (name: string) => { value: string } | undefined } } {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.host) headers.set("host", opts.host);
  const req = new Request("https://shelterdk.dk/api/track", {
    method: "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }) as Request & { cookies: { get: (name: string) => { value: string } | undefined } };

  const cookiesMap = opts.cookie ? parseCookies(opts.cookie) : new Map<string, string>();
  req.cookies = {
    get: (name: string) => {
      const value = cookiesMap.get(name);
      return value !== undefined ? { value } : undefined;
    },
  };

  return req;
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

describe("POST /api/track", () => {
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

  it("returnerer 204 uden at sende GA4 når consent er accept", async () => {
    const req = mockRequest({
      cookie: "shelterdk_consent=accept; _ga=GA1.1.12345.67890",
      body: { event: "outbound_click", params: { link_label: "Book" }, path: "/faq" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(0);
  });

  it("sender custom event til GA4 når consent er necessary", async () => {
    const req = mockRequest({
      cookie: "shelterdk_consent=necessary",
      host: "shelterdk.dk",
      body: {
        event: "outbound_click",
        params: { link_label: "Book", outbound_url: "https://example.com", important: true },
        path: "/shelter/test",
        title: "Test shelter",
        referrer: "https://google.com/",
      },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(204);
    expect(fetchCalls).toHaveLength(1);
    const body = fetchCalls[0].body as { client_id: string; events: Array<{ name: string; params: Record<string, unknown> }> };
    expect(body.client_id).toMatch(/^[0-9a-f]{16}$/i);
    expect(body.events[0]).toMatchObject({
      name: "outbound_click",
      params: {
        link_label: "Book",
        outbound_url: "https://example.com",
        important: "true",
        page_location: "https://shelterdk.dk/shelter/test",
        page_title: "Test shelter",
        page_referrer: "https://google.com/",
      },
    });
  });

  it("afviser ukendte events", async () => {
    const req = mockRequest({ body: { event: "totally_custom" } });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(fetchCalls).toHaveLength(0);
  });
});
