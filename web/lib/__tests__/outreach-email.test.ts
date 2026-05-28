import { describe, it, expect, vi } from "vitest";

// sendOutreachEmail importerer email.ts (Resend/Supabase). Vi tester kun
// den rene bodyToHtml-renderer, så vi mocker email-modulet væk.
vi.mock("@/lib/email", () => ({
  sendLoggedEmail: vi.fn(),
  escapeHtml: (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"),
}));

import { bodyToHtml } from "@/lib/outreach-email";

describe("bodyToHtml", () => {
  it("renderer afsnit adskilt af blank linje som <p>", () => {
    const html = bodyToHtml("Første afsnit.\n\nAndet afsnit.");
    expect(html).toContain("<p");
    expect((html.match(/<p/g) ?? []).length).toBe(2);
    expect(html).toContain("Første afsnit.");
    expect(html).toContain("Andet afsnit.");
  });

  it("renderer '- ' linjer som punktliste", () => {
    const html = bodyToHtml("- Punkt et\n- Punkt to\n- Punkt tre");
    expect(html).toContain("<ul");
    expect((html.match(/<li/g) ?? []).length).toBe(3);
    expect(html).not.toContain("- Punkt");
  });

  it("renderer '1. ' linjer som nummereret liste", () => {
    const html = bodyToHtml("1. Først\n2. Dernæst");
    expect(html).toContain("<ol");
    expect((html.match(/<li/g) ?? []).length).toBe(2);
  });

  it("konverterer **fed** til <strong>", () => {
    const html = bodyToHtml("Dette er **vigtigt** at vide.");
    expect(html).toContain("<strong>vigtigt</strong>");
  });

  it("fed virker også inde i listepunkter", () => {
    const html = bodyToHtml("- **Lead-in:** resten af teksten");
    expect(html).toContain("<li");
    expect(html).toContain("<strong>Lead-in:</strong>");
  });

  it("auto-linker http(s)-URLs", () => {
    const html = bodyToHtml("Se her: https://shelterdk.dk/demo/ejer");
    expect(html).toContain('<a href="https://shelterdk.dk/demo/ejer"');
  });

  it("escaper HTML i input (ingen injection)", () => {
    const html = bodyToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("enkelt-linjeskift i afsnit bliver til <br/>", () => {
    const html = bodyToHtml("Linje 1\nLinje 2");
    expect(html).toContain("Linje 1<br/>Linje 2");
  });
});
