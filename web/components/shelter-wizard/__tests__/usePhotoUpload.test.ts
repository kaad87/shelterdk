import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePhotoUpload } from "../usePhotoUpload";

function mockFile(name = "a.jpg", type = "image/jpeg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe("usePhotoUpload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tilføjer et billede ved succesfuld upload", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ path: "pending/x.jpg", previewUrl: "blob:1", deleteToken: "t" }), { status: 200 })
    );
    const { result } = renderHook(() => usePhotoUpload("hp"));
    await act(async () => { await result.current.addPhoto(mockFile()); });
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.photos[0].path).toBe("pending/x.jpg");
    expect(result.current.error).toBeNull();
  });

  it("sætter synlig fejl når upload fejler", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Upload fejlede — prøv igen" }), { status: 500 })
    );
    const { result } = renderHook(() => usePhotoUpload("hp"));
    await act(async () => { await result.current.addPhoto(mockFile()); });
    expect(result.current.photos).toHaveLength(0);
    expect(result.current.error).toBe("Upload fejlede — prøv igen");
  });

  it("afviser mere end 5 billeder", async () => {
    // Fresh Response per call: a Response body can only be read once.
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ path: "pending/x.jpg", previewUrl: null, deleteToken: "t" }), { status: 200 })
    );
    const { result } = renderHook(() => usePhotoUpload("hp"));
    for (let i = 0; i < 5; i++) {
      await act(async () => { await result.current.addPhoto(mockFile()); });
    }
    await act(async () => { await result.current.addPhoto(mockFile()); });
    expect(result.current.photos).toHaveLength(5);
    expect(result.current.error).toMatch(/maks 5/i);
  });
});
