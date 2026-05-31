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
  delete process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
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
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("gemmer accept og skjuler banner ved Acceptér alle", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /acceptér alle/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("marketing");
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });

  it("gemmer analytics ved Kun statistik", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun statistik/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("analytics");
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });

  it("gemmer necessary og skjuler banner ved Kun nødvendige", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun nødvendige/i }));
    expect(storage.getStore()[CONSENT_KEY]).toBe("necessary");
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
  });

  it("viser GTM script altid (Consent Mode v2)", () => {
    render(<CookieBanner />);
    expect(screen.getByTestId("script-gtm")).toBeInTheDocument();
  });

  it("viser StackAdapt kun ved markedsføringssamtykke", () => {
    render(<CookieBanner />);
    expect(screen.queryByTestId("script-stackadapt-events")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /acceptér alle/i }));
    expect(screen.getByTestId("script-stackadapt-events")).toBeInTheDocument();
  });

  it("loader AdSense for alle når pub-ID er sat (Consent Mode v2 styrer personalisering)", () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = "ca-pub-123";
    render(<CookieBanner />);
    // AdSense-scriptet loader UDEN marketing-samtykke. Consent Mode v2
    // (sat i layout.tsx + opdateret af banneret) sørger for at ads er
    // ikke-personaliserede indtil brugeren accepterer marketing.
    expect(screen.getByTestId("script-adsense")).toBeInTheDocument();
  });

  it("loader IKKE AdSense når pub-ID mangler", () => {
    render(<CookieBanner />); // NEXT_PUBLIC_ADSENSE_PUB_ID slettet i beforeEach
    expect(screen.queryByTestId("script-adsense")).not.toBeInTheDocument();
  });

  it("viser IKKE StackAdapt ved analytics", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun statistik/i }));
    expect(screen.queryByTestId("script-stackadapt-events")).not.toBeInTheDocument();
  });

  it("viser IKKE StackAdapt ved necessary", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /kun nødvendige/i }));
    expect(screen.queryByTestId("script-stackadapt-events")).not.toBeInTheDocument();
  });

  it("skjuler banner og viser StackAdapt når marketing allerede er gemt", () => {
    storage.setStore(CONSENT_KEY, "marketing");
    render(<CookieBanner />);
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("script-stackadapt-events")).toBeInTheDocument();
  });

  it("skjuler banner når analytics allerede er gemt", () => {
    storage.setStore(CONSENT_KEY, "analytics");
    render(<CookieBanner />);
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("script-stackadapt-events")).not.toBeInTheDocument();
  });

  it("skjuler banner når necessary allerede er gemt", () => {
    storage.setStore(CONSENT_KEY, "necessary");
    render(<CookieBanner />);
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("script-stackadapt-events")).not.toBeInTheDocument();
  });
});
