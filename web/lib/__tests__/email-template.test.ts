import { describe, it, expect } from "vitest";
import { renderEmail, renderEmailText } from "../email";

describe("renderEmail()", () => {
  it("produces a complete HTML document", () => {
    const html = renderEmail({ title: "Test", bodyHtml: "<p>body</p>" });
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("includes the title in the header", () => {
    const html = renderEmail({ title: "Min titel", bodyHtml: "<p>x</p>" });
    expect(html).toContain("Min titel");
  });

  it("shows SHELTERDK wordmark", () => {
    const html = renderEmail({ title: "T", bodyHtml: "" });
    expect(html).toContain("SHELTERDK");
  });

  it("renders bodyHtml verbatim", () => {
    const html = renderEmail({ title: "T", bodyHtml: '<p class="x">hello</p>' });
    expect(html).toContain('<p class="x">hello</p>');
  });

  it("includes footer link to shelterdk.dk", () => {
    const html = renderEmail({ title: "T", bodyHtml: "" });
    expect(html).toContain("shelterdk.dk");
  });

  it("includes preheader div when provided", () => {
    const html = renderEmail({ title: "T", bodyHtml: "", preheader: "Preview text here" });
    expect(html).toContain("Preview text here");
  });

  it("omits preheader element when not provided", () => {
    const html = renderEmail({ title: "T", bodyHtml: "" });
    expect(html).not.toContain("mso-hide:all");
  });

  it("escapes title for XSS", () => {
    const html = renderEmail({ title: "<script>alert(1)</script>", bodyHtml: "" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderEmailText()", () => {
  it("starts with SHELTERDK — {title}", () => {
    const text = renderEmailText({ title: "Booking bekræftet", lines: [] });
    expect(text).toContain("SHELTERDK — Booking bekræftet");
  });

  it("includes all lines", () => {
    const text = renderEmailText({ title: "T", lines: ["Hej Lars", "Din booking er klar"] });
    expect(text).toContain("Hej Lars");
    expect(text).toContain("Din booking er klar");
  });

  it("includes url when provided", () => {
    const text = renderEmailText({ title: "T", lines: [], url: "https://shelterdk.dk/min-booking/abc" });
    expect(text).toContain("https://shelterdk.dk/min-booking/abc");
  });

  it("omits url section when not provided", () => {
    const text = renderEmailText({ title: "T", lines: ["Hej"] });
    expect(text).not.toContain("https://");
  });

  it("ends with shelterdk.dk", () => {
    const text = renderEmailText({ title: "T", lines: [] });
    expect(text.trim().endsWith("shelterdk.dk")).toBe(true);
  });
});
