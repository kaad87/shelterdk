import { describe, it, expect } from "vitest";
import {
  buildBookingActivationAdminHtml,
  buildBookingActivationConfirmHtml,
} from "@/lib/email";

describe("buildBookingActivationAdminHtml", () => {
  const opts = {
    name: "Christian Kaad",
    organisation: "Geopark Odsherred",
    email: "christian@example.dk",
    shelterName: "Skovhytten",
    message: "Gerne hurtigt",
  };

  it("includes shelter name", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("Skovhytten");
  });
  it("includes organisation", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("Geopark Odsherred");
  });
  it("includes email", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("christian@example.dk");
  });
  it("includes optional message", () => {
    expect(buildBookingActivationAdminHtml(opts)).toContain("Gerne hurtigt");
  });
  it("escapes HTML in name", () => {
    expect(
      buildBookingActivationAdminHtml({ ...opts, name: "<script>" })
    ).not.toContain("<script>");
  });
});

describe("buildBookingActivationConfirmHtml", () => {
  const opts = { name: "Christian Kaad", shelterName: "Skovhytten" };

  it("includes shelter name", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("Skovhytten");
  });
  it("includes name", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("Christian Kaad");
  });
  it("mentions 2 hverdage", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("2 hverdage");
  });
  it("includes signature shelterdk.dk", () => {
    expect(buildBookingActivationConfirmHtml(opts)).toContain("shelterdk.dk");
  });
  it("escapes HTML in shelter name", () => {
    expect(
      buildBookingActivationConfirmHtml({ ...opts, shelterName: "<b>xss</b>" })
    ).not.toContain("<b>xss</b>");
  });
});
