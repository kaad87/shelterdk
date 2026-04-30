import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor } from "@/test/test-utils";
import { CollectPageView } from "../CollectPageView";
import { CONSENT_KEY, CONSENT_UPDATED_EVENT } from "@/lib/consent";

let mockPathname = "/";
let mockQuery = "";

const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

describe("CollectPageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();
    document.title = "ShelterDK";
    mockPathname = "/";
    mockQuery = "";
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sender page_view med querystring for necessary consent", async () => {
    localStorage.setItem(CONSENT_KEY, "necessary");
    mockPathname = "/soeg";
    mockQuery = "region=Jylland&q=aarhus";
    window.history.pushState({}, "", "/soeg?region=Jylland&q=aarhus");

    render(<CollectPageView />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/collect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          path: "/soeg?region=Jylland&q=aarhus",
          title: "ShelterDK",
          referrer: "",
        }),
      })
    );
  });

  it("sender straks første page_view når consent skifter til necessary", async () => {
    mockPathname = "/faq";
    window.history.pushState({}, "", "/faq");

    render(<CollectPageView />);
    expect(mockFetch).not.toHaveBeenCalled();

    localStorage.setItem(CONSENT_KEY, "necessary");
    act(() => {
      window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: "necessary" }));
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/collect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          path: "/faq",
          title: "ShelterDK",
          referrer: "",
        }),
      })
    );
  });
});
