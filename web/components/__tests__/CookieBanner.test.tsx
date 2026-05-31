import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
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

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
});

describe("CookieBanner", () => {
  it("viser INGEN egen samtykke-dialog (Googles CMP er det eneste banner)", () => {
    render(<CookieBanner />);
    expect(screen.queryByRole("dialog", { name: /cookievalg/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /acceptér alle/i })).not.toBeInTheDocument();
  });

  it("loader GTM altid (Consent Mode v2)", () => {
    render(<CookieBanner />);
    expect(screen.getByTestId("script-gtm")).toBeInTheDocument();
  });

  it("loader AdSense for alle når pub-ID er sat", () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = "ca-pub-123";
    render(<CookieBanner />);
    expect(screen.getByTestId("script-adsense")).toBeInTheDocument();
  });

  it("loader IKKE AdSense når pub-ID mangler", () => {
    render(<CookieBanner />);
    expect(screen.queryByTestId("script-adsense")).not.toBeInTheDocument();
  });

  it("loader IKKE StackAdapt (fjernet)", () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = "ca-pub-123";
    render(<CookieBanner />);
    expect(screen.queryByTestId("script-stackadapt-events")).not.toBeInTheDocument();
  });
});
