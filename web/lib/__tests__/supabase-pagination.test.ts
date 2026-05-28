import { describe, it, expect, vi } from "vitest";
import { querySupabaseWithRetry } from "@/lib/supabase-pagination";

describe("querySupabaseWithRetry", () => {
  it("returnerer data ved succes i første forsøg", async () => {
    const runQuery = vi.fn().mockResolvedValue({ data: [1, 2, 3], error: null });
    const result = await querySupabaseWithRetry<number[]>(runQuery);
    expect(result).toEqual([1, 2, 3]);
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  it("retryer på transient fejl og lykkes derefter", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "timeout" } })
      .mockResolvedValueOnce({ data: null, error: { message: "timeout" } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });
    const result = await querySupabaseWithRetry<string[]>(runQuery, { baseDelayMs: 1 });
    expect(result).toEqual(["ok"]);
    expect(runQuery).toHaveBeenCalledTimes(3);
  });

  it("kaster efter at alle forsøg er udtømt", async () => {
    const err = { message: "still down" };
    const runQuery = vi.fn().mockResolvedValue({ data: null, error: err });
    await expect(
      querySupabaseWithRetry(runQuery, { maxRetries: 2, baseDelayMs: 1 })
    ).rejects.toEqual(err);
    // 1 initial + 2 retries = 3 kald
    expect(runQuery).toHaveBeenCalledTimes(3);
  });

  it("returnerer null hvis query giver null-data uden fejl", async () => {
    const runQuery = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await querySupabaseWithRetry(runQuery);
    expect(result).toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  it("bygger queryen på ny i hvert forsøg (builders er single-use)", async () => {
    let builds = 0;
    const runQuery = vi.fn().mockImplementation(() => {
      builds += 1;
      return Promise.resolve(
        builds < 2 ? { data: null, error: { message: "timeout" } } : { data: ["v"], error: null }
      );
    });
    const result = await querySupabaseWithRetry<string[]>(runQuery, { baseDelayMs: 1 });
    expect(result).toEqual(["v"]);
    expect(builds).toBe(2);
  });
});
