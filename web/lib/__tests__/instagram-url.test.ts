import { describe, it, expect } from "vitest";
import { normalizeInstagramPostUrl, isValidInstagramPostUrl } from "../instagram-url";

describe("normalizeInstagramPostUrl", () => {
  it("normaliserer /p/ URL", () => {
    expect(normalizeInstagramPostUrl("https://www.instagram.com/p/ABCxyz/")).toBe(
      "https://www.instagram.com/p/ABCxyz/"
    );
  });

  it("accepterer reel", () => {
    expect(normalizeInstagramPostUrl("https://instagram.com/reel/AbCdEf123/")).toBe(
      "https://www.instagram.com/reel/AbCdEf123/"
    );
  });

  it("stripper query-parametre", () => {
    expect(
      normalizeInstagramPostUrl("https://www.instagram.com/p/ABCxyz/?utm_source=ig")
    ).toBe("https://www.instagram.com/p/ABCxyz/");
  });

  it("accepterer URL med brugernavn foran /p/", () => {
    expect(
      normalizeInstagramPostUrl("https://www.instagram.com/shelter_214/p/DH86bUYMTB9/")
    ).toBe("https://www.instagram.com/p/DH86bUYMTB9/");
  });

  it("accepterer URL med brugernavn foran /reel/", () => {
    expect(
      normalizeInstagramPostUrl("https://www.instagram.com/glamping_danmark/reel/CTww4mYA8NL/")
    ).toBe("https://www.instagram.com/reel/CTww4mYA8NL/");
  });

  it("afviser ugyldige URLer", () => {
    expect(normalizeInstagramPostUrl("https://example.com")).toBeNull();
    expect(isValidInstagramPostUrl("not a url")).toBe(false);
    expect(normalizeInstagramPostUrl("https://www.instagram.com/someguy/")).toBeNull();
  });
});
