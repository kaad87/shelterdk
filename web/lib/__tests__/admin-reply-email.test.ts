import { describe, it, expect } from "vitest";
import { buildAdminReplyEmailHtml, buildAdminReplyEmailText } from "../email";

describe("buildAdminReplyEmailHtml()", () => {
  const opts = {
    toName: "Lars",
    replyText: "Tak for din henvendelse, vi kigger på det.",
    originalMessage: "Hej, jeg kan ikke booke shelter X.",
  };

  it("includes the reply text", () => {
    const html = buildAdminReplyEmailHtml(opts);
    expect(html).toContain("Tak for din henvendelse");
  });

  it("includes the original message quoted", () => {
    const html = buildAdminReplyEmailHtml(opts);
    expect(html).toContain("Hej, jeg kan ikke booke shelter X.");
  });

  it("includes the signature", () => {
    const html = buildAdminReplyEmailHtml(opts);
    expect(html).toContain("Christian");
    expect(html).toContain("ShelterDK");
  });

  it("escapes HTML in replyText", () => {
    const html = buildAdminReplyEmailHtml({ ...opts, replyText: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in originalMessage", () => {
    const html = buildAdminReplyEmailHtml({ ...opts, originalMessage: '<img src=x onerror="xss">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes HTML in toName", () => {
    const html = buildAdminReplyEmailHtml({ ...opts, toName: "<b>Hacker</b>" });
    expect(html).not.toContain("<b>Hacker</b>");
  });
});

describe("buildAdminReplyEmailText()", () => {
  const opts = {
    replyText: "Hej, vi har set på sagen.",
    originalMessage: "Problemet er at X ikke virker.",
  };

  it("includes the reply text", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text).toContain("vi har set på sagen");
  });

  it("includes the original message", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text).toContain("Problemet er at X ikke virker");
  });

  it("includes signature name", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text).toContain("Christian");
  });

  it("ends with shelterdk.dk", () => {
    const text = buildAdminReplyEmailText(opts);
    expect(text.trim().endsWith("shelterdk.dk")).toBe(true);
  });
});
