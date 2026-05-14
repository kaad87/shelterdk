import { describe, it, expect } from "vitest";
import {
  buildShelterApprovedEmailHtml,
  buildShelterRejectedEmailHtml,
} from "../email";

describe("buildShelterApprovedEmailHtml", () => {
  it("includes shelter name in subject area", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "Skovhytten",
      shelterSlug: "skovhytten-abc123",
    });
    expect(html).toContain("Skovhytten");
  });

  it("links to the shelter page", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "Ege Shelter",
      shelterSlug: "ege-shelter-xyz789",
    });
    expect(html).toContain("/shelter/ege-shelter-xyz789");
  });

  it("escapes HTML in shelter name", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "<script>alert(1)</script>",
      shelterSlug: "test-abc123",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes signature with shelterdk.dk", () => {
    const html = buildShelterApprovedEmailHtml({
      shelterName: "Test",
      shelterSlug: "test-abc123",
    });
    expect(html).toContain("shelterdk.dk");
    expect(html).toContain("Christian");
  });
});

describe("buildShelterRejectedEmailHtml", () => {
  it("includes rejection reason", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Skovhytten",
      reason: "Mangler koordinater og billeder.",
    });
    expect(html).toContain("Mangler koordinater og billeder.");
  });

  it("escapes HTML in rejection reason", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Test",
      reason: "<b>bad</b>",
    });
    expect(html).not.toContain("<b>bad</b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("includes shelter name", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Havnens Shelter",
      reason: "Ikke nok info.",
    });
    expect(html).toContain("Havnens Shelter");
  });

  it("mentions submitting again", () => {
    const html = buildShelterRejectedEmailHtml({
      shelterName: "Test",
      reason: "Test reason.",
    });
    expect(html.toLowerCase()).toMatch(/indsend|ansøg/);
  });
});
