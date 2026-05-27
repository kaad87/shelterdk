import { describe, it, expect } from "vitest";
import { computeImageProxyKey, getProxiedImageSrc, isUnoptimizedImageUrl } from "../image-proxy";

describe("getProxiedImageSrc", () => {
  it("returns proxy URL without opts", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg");
    const key = computeImageProxyKey("https://example.com/img.jpg");
    expect(result).toBe(`/api/image/${key}?url=https%3A%2F%2Fexample.com%2Fimg.jpg`);
  });

  it("appends quality param when opts.q provided", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { q: 70 });
    const key = computeImageProxyKey("https://example.com/img.jpg", { q: 70 });
    expect(result).toBe(`/api/image/${key}?url=https%3A%2F%2Fexample.com%2Fimg.jpg&q=70`);
  });

  it("appends width param when opts.w provided", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { w: 400 });
    const key = computeImageProxyKey("https://example.com/img.jpg", { w: 400 });
    expect(result).toBe(`/api/image/${key}?url=https%3A%2F%2Fexample.com%2Fimg.jpg&w=400`);
  });

  it("appends both q and w when provided", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { q: 70, w: 400 });
    expect(result).toContain("/api/image/");
    expect(result).toContain("&q=70");
    expect(result).toContain("&w=400");
  });

  it("skips proxy for already-proxied URLs but appends opts", () => {
    const result = getProxiedImageSrc("/api/image/abc123?url=foo", { q: 70 });
    expect(result).toBe("/api/image/abc123?url=foo&q=70");
  });

  it("skips proxy for google-photo URLs", () => {
    const result = getProxiedImageSrc("/api/google-photo?ref=abc");
    expect(result).toBe("/api/google-photo?ref=abc");
  });

  it("returns empty string for empty input", () => {
    expect(getProxiedImageSrc("")).toBe("");
  });

  it("skips SKIP_PROXY_HOSTS", () => {
    const result = getProxiedImageSrc("https://lh3.googleusercontent.com/img.jpg");
    expect(result).toBe("https://lh3.googleusercontent.com/img.jpg");
  });

  it("treats proxied /api/image URLs as already optimized", () => {
    expect(isUnoptimizedImageUrl("/api/image/abc123?url=https%3A%2F%2Fexample.com%2Fimg.jpg&w=720&q=70")).toBe(true);
  });

  it("skips proxy for stable hosts like Unsplash", () => {
    const result = getProxiedImageSrc("https://images.unsplash.com/photo-123");
    expect(result).toBe("https://images.unsplash.com/photo-123");
  });
});
