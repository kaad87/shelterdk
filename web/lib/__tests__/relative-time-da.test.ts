import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTimeDa } from "../relative-time-da";

describe("formatRelativeTimeDa", () => {
  const fixedNow = new Date("2025-02-11T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returnerer 'lige nu' for meget nyligt tidspunkt", () => {
    const d = new Date("2025-02-11T11:59:30Z");
    expect(formatRelativeTimeDa(d)).toBe("lige nu");
  });

  it("returnerer minutter for få minutter siden", () => {
    const d = new Date("2025-02-11T11:55:00Z");
    expect(formatRelativeTimeDa(d)).toBe("for 5 minutter siden");
  });

  it("returnerer singular for 1 minut", () => {
    const d = new Date("2025-02-11T11:59:00Z");
    expect(formatRelativeTimeDa(d)).toBe("for 1 minut siden");
  });

  it("returnerer timer for få timer siden", () => {
    const d = new Date("2025-02-11T10:00:00Z");
    expect(formatRelativeTimeDa(d)).toBe("for 2 timer siden");
  });

  it("returnerer dage for få dage siden", () => {
    const d = new Date("2025-02-10T12:00:00Z");
    expect(formatRelativeTimeDa(d)).toBe("for 1 dag siden");
  });

  it("returnerer uger for få uger siden", () => {
    const d = new Date("2025-02-04T12:00:00Z");
    expect(formatRelativeTimeDa(d)).toBe("for 1 uge siden");
  });
});
