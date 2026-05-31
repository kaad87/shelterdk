import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { CookieBanner } from "../CookieBanner";

vi.mock("next/script", () => ({
  default: function MockScript({
    id,
    children,
    dangerouslySetInnerHTML,
  }: {
    id?: string;
    children?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) {
    return (
      <div data-testid={`script-${id ?? "anon"}`} data-id={id}>
        {dangerouslySetInnerHTML?.__html ?? children ?? null}
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

  it("viser Acceptér alle, Kun statistik og Kun nødvendige knapper", () => {
    render(<CookieBanner />);
    expect(screen.getByRole("button", { name: /acceptér alle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kun statistik/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kun nødvendige/i })).toBeInTheDocument();
  });

  it("viser link til privatlivsside", () => {
    render(<CookieBanner />);
    const link = screen.getByRole("link", { name: /læs mere om cookies/i });
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("gemmer marketing og skjuler banner ved Acceptér alle", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /acceptér alle/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("marketing");
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });

  it("gemmer analytics ved Kun statistik", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun statistik/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("analytics");
  });

  it("gemmer necessary ved Kun nødvendige", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun nødvendige/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("necessary");
  });

  it("viser GTM-script altid (Consent Mode v2)", () => {
    render(<CookieBanner />);
    expect(screen.getByTestId("script-gtm")).toBeInTheDocument();
  });

  it("loader IKKE AdSense (fjernet)", () => {
    render(<CookieBanner />);
    expect(screen.queryByTestId("script-adsense")).not.toBeInTheDocument();
  });

  it("skjuler banner når samtykke allerede er gemt", () => {
    storage.setStore(CONSENT_KEY, "marketing");
    render(<CookieBanner />);
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });
});
