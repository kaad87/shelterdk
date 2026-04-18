import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createAdminClient
vi.mock("@/utils/supabase/server-admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/utils/supabase/server-admin";
import { POST } from "../upload-url/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/experiences/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/experiences/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if fileCount is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 if fileCount > 4", async () => {
    const res = await POST(makeRequest({ fileCount: 5 }));
    expect(res.status).toBe(400);
  });

  it("returns presigned URLs for valid fileCount", async () => {
    const mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://example.com/signed", token: "tok", path: "abc/0.webp" },
            error: null,
          }),
        }),
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(mockStorageClient as ReturnType<typeof createAdminClient>);

    const res = await POST(makeRequest({ fileCount: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploads).toHaveLength(2);
    expect(body.experienceId).toBeTruthy();
    expect(body.uploads[0]).toMatchObject({ index: 0, signedUrl: expect.any(String), token: expect.any(String), path: expect.any(String) });
  });
});
