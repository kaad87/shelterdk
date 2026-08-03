import { describe, it, expect, vi } from "vitest";
import {
  computeImageProxyKey,
  getProxiedImageSrc,
  isUnoptimizedImageUrl,
  netlifyImageLoader,
} from "../image-proxy";

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

describe("getProxiedImageSrc – Netlify Image CDN i produktion", () => {
  it("bruger /.netlify/images i production (edge-transform, ingen sharp)", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const result = getProxiedImageSrc("https://example.com/img.jpg", { w: 720, q: 70 });
      expect(result).toBe(
        "/.netlify/images?url=https%3A%2F%2Fexample.com%2Fimg.jpg&q=70&w=720"
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("bruger stadig /api/image i dev/test", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { w: 720 });
    expect(result).toContain("/api/image/");
  });

  it("skip-hosts går stadig direkte uden om CDN i production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const result = getProxiedImageSrc("https://images.unsplash.com/img.jpg", { w: 720 });
      expect(result).toBe("https://images.unsplash.com/img.jpg");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("behandler /.netlify/images som allerede optimeret (ingen dobbelt-hop)", () => {
    expect(isUnoptimizedImageUrl("/.netlify/images?url=x&w=720")).toBe(true);
  });
});

describe("mapcentia S3 skal proxies", () => {
  const MAPCENTIA =
    "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/abc.jpg";

  // Regression: hosten stod på skip-listen og leverede 571 KB–1,2 MB rå
  // 1600px-originaler direkte til browseren. Den er hovedkilden til billeder
  // (1.269 af 1.397 shelters), så den MÅ ikke tilbage på listen.
  it("springer IKKE proxy over — rå S3 er objektlager, ikke en image-CDN", () => {
    expect(isUnoptimizedImageUrl(MAPCENTIA)).toBe(false);
    expect(getProxiedImageSrc(MAPCENTIA, { w: 720, q: 70 })).toContain("/api/image/");
  });

  it("går gennem Netlify Image CDN i produktion", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(getProxiedImageSrc(MAPCENTIA, { w: 720, q: 70 })).toBe(
        `/.netlify/images?url=${encodeURIComponent(MAPCENTIA)}&q=70&w=720`
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("netlifyImageLoader", () => {
  it("giver forskellig URL pr. bredde, så Next kan bygge et srcset", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const small = netlifyImageLoader({ src: "https://example.com/i.jpg", width: 384 });
      const large = netlifyImageLoader({ src: "https://example.com/i.jpg", width: 1080 });
      expect(small).toContain("&w=384");
      expect(large).toContain("&w=1080");
      expect(small).not.toBe(large);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("falder tilbage til q=70 når Next ikke giver en quality", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(netlifyImageLoader({ src: "https://example.com/i.jpg", width: 640 })).toContain(
        "&q=70"
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("lader URL'er vi ikke transformerer være i fred", () => {
    expect(
      netlifyImageLoader({ src: "/api/google-photo?ref=abc", width: 640 })
    ).toBe("/api/google-photo?ref=abc");
    expect(
      netlifyImageLoader({ src: "https://images.unsplash.com/photo-1", width: 640 })
    ).toBe("https://images.unsplash.com/photo-1");
  });
});
