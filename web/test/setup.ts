/** Vitest setup – mock browser APIs som jsdom ikke har. */
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];

  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock fetch – undgår netværkskald i tests
if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), { status: 200 });
}
