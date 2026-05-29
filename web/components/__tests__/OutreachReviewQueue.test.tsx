import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitForElementToBeRemoved } from "@/test/test-utils";
import { OutreachReviewQueue } from "../OutreachReviewQueue";

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    shelter: {
      id: "shelter-1",
      title: "Test Shelter",
      slug: "test-shelter",
      kommune: "Testby",
      region: "Jylland",
      description: "En beskrivelse",
    },
    score: 21,
    category: "high",
    recipientEmailSuggestion: null,
    recipientNameSuggestion: "Testby Kommune",
    signals: ["mobilepay"],
    negativeSignals: [],
    excerpt: "Et uddrag",
    review: null,
    ...overrides,
  };
}

function candidatesResponse(items: unknown[]) {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: 1,
    counts: {
      total: items.length,
      pending: items.length,
      sent: 0,
      replied: 0,
      not_relevant: 0,
      needs_research: 0,
    },
  };
}

describe("OutreachReviewQueue", () => {
  let candidatesCalls: number;
  let patchBody: Record<string, unknown> | null;

  beforeEach(() => {
    candidatesCalls = 0;
    patchBody = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (url.includes("/api/admin/outreach/template")) {
          return new Response(JSON.stringify({ subject: "Emne", body: "Body" }), { status: 200 });
        }

        if (url.includes("/api/admin/outreach-candidates")) {
          candidatesCalls += 1;
          if (candidatesCalls === 1) {
            return new Response(JSON.stringify(candidatesResponse([makeCandidate()])), { status: 200 });
          }
          // The silent background reload never resolves during the test, so a
          // disappearing card can ONLY come from the optimistic local update.
          return new Promise<Response>(() => {});
        }

        if (url.endsWith("/api/admin/outreach")) {
          if (method === "PATCH") {
            patchBody = JSON.parse(String(init?.body ?? "{}"));
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fjerner kortet fra "ikke kontaktet"-listen med det samme når man markerer "Ikke relevant"', async () => {
    render(<OutreachReviewQueue secret="test-secret" />);

    // Kortet er der efter initial load.
    expect(await screen.findByText("Test Shelter")).toBeInTheDocument();

    // Klik "Ikke relevant".
    fireEvent.click(screen.getByRole("button", { name: /ikke relevant/i }));

    // Kortet forsvinder med det samme (optimistisk) — uden at vente på den
    // tunge baggrunds-reload (som aldrig resolver i testen).
    await waitForElementToBeRemoved(() => screen.queryByText("Test Shelter"));

    // ...og PATCH blev sendt med korrekt status.
    expect(patchBody).toMatchObject({ shelter_id: "shelter-1", status: "not_relevant" });
  });
});
