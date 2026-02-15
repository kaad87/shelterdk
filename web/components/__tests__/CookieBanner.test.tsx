import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { CookieBanner } from "../CookieBanner";

vi.mock("next/script", () => ({
  default: function MockScript({
    id,
    dangerouslySetInnerHTML,
  }: {
    id: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) {
    return (
      <div data-testid="gtm-script" data-id={id}>
        {dangerouslySetInnerHTML?.__html ? "GTM loaded" : null}
      </div>
    );
  },
}));

const CONSENT_KEY = "shelterdk_consent";

function createStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    setStore: (key: string, value: string) => {
      store[key] = value;
    },
    getStore: () => ({ ...store }),
  };
}

let storage: ReturnType<typeof createStorageMock>;

beforeEach(() => {
  storage = createStorageMock();
  Object.defineProperty(window, "localStorage", {
    value: storage,
    writable: true,
  });
});

describe("CookieBanner", () => {
  it("viser banner når der ikke er gemt samtykke", () => {
    render(<CookieBanner />);
    expect(screen.getByRole("dialog", { name: /cookievalg/i })).toBeInTheDocument();
  });

  it("viser Acceptér alle og Kun nødvendige knapper", () => {
    render(<CookieBanner />);
    expect(screen.getByRole("button", { name: /acceptér alle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kun nødvendige/i })).toBeInTheDocument();
  });

  it("viser link til privatlivsside", () => {
    render(<CookieBanner />);
    const link = screen.getByRole("link", { name: /læs mere om cookies/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("gemmer accept og skjuler banner ved Acceptér alle", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /acceptér alle/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("accept");
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });

  it("gemmer necessary og skjuler banner ved Kun nødvendige", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun nødvendige/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("necessary");
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });

  it("viser GTM Script når samtykke er accept", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /acceptér alle/i }));
    expect(screen.getByTestId("gtm-script")).toBeInTheDocument();
  });

  it("viser IKKE GTM Script når samtykke er necessary", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun nødvendige/i }));
    expect(screen.queryByTestId("gtm-script")).not.toBeInTheDocument();
  });

  it("skjuler banner og viser GTM når accept allerede er gemt", () => {
    storage.setStore(CONSENT_KEY, "accept");
    render(<CookieBanner />);
    expect(screen.getByTestId("gtm-script")).toBeInTheDocument();
  });

  it("skjuler banner når necessary allerede er gemt", () => {
    storage.setStore(CONSENT_KEY, "necessary");
    render(<CookieBanner />);
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("gtm-script")).not.toBeInTheDocument();
  });
});
