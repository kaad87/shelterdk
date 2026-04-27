import { describe, it, expect } from "vitest";
import { validateMessageBody } from "@/lib/messages-db";

describe("validateMessageBody", () => {
  it("returns null for a normal message", () => {
    expect(validateMessageBody("Hej, må vi medbringe hund?")).toBeNull();
  });

  it("returns error for empty string", () => {
    expect(validateMessageBody("")).not.toBeNull();
  });

  it("returns error for whitespace-only string", () => {
    expect(validateMessageBody("   \n  ")).not.toBeNull();
  });

  it("returns error for body over 2000 chars", () => {
    expect(validateMessageBody("x".repeat(2001))).not.toBeNull();
  });

  it("returns null for exactly 2000 chars", () => {
    expect(validateMessageBody("x".repeat(2000))).toBeNull();
  });

  it("returns error for non-string (null)", () => {
    expect(validateMessageBody(null)).not.toBeNull();
  });

  it("returns error for non-string (number)", () => {
    expect(validateMessageBody(42)).not.toBeNull();
  });
});
