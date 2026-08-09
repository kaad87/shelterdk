import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STALE_BUILD_RECOVERY_SCRIPT,
  STALE_BUILD_GUARD_KEY,
} from "../stale-build-recovery-script";

/**
 * Testen evaluerer den PRÆCIS SAMME streng som layoutet indsætter i <head>, så
 * der ikke kan opstå forskel mellem det testede og det udsendte.
 *
 * Vigtigst er løkke-sikringen: en genindlæsning der udløser sig selv igen ville
 * være markant værre end den fejl den skal rette.
 */
const reload = vi.fn();

function armScript() {
  // Samme udførelse som browseren: synkront, før nogen chunk indlæses.
  // eslint-disable-next-line no-new-func
  new Function(STALE_BUILD_RECOVERY_SCRIPT)();
}

function fireScriptError(src: string) {
  const el = document.createElement("script");
  Object.defineProperty(el, "src", { value: src, configurable: true });
  const ev = new Event("error");
  Object.defineProperty(ev, "target", { value: el, configurable: true });
  window.dispatchEvent(ev);
}

beforeEach(() => {
  reload.mockClear();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload },
    writable: true,
    configurable: true,
  });
});

describe("stale-build-recovery inline-script", () => {
  it("genindlæser når en Next-chunk ikke kan hentes", () => {
    armScript();
    fireScriptError("https://shelterdk.dk/_next/static/chunks/webpack-deadbeef.js");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STALE_BUILD_GUARD_KEY)).toBe("1");
  });

  it("genindlæser HØJST én gang pr. fane — ingen reload-løkke", () => {
    armScript();
    fireScriptError("https://shelterdk.dk/_next/static/chunks/webpack-deadbeef.js");
    fireScriptError("https://shelterdk.dk/_next/static/chunks/page-cafebabe.js");
    fireScriptError("https://shelterdk.dk/_next/static/chunks/main-12345678.js");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("genindlæser ikke igen i en fane der allerede har gjort det", () => {
    sessionStorage.setItem(STALE_BUILD_GUARD_KEY, "1");
    armScript();
    fireScriptError("https://shelterdk.dk/_next/static/chunks/webpack-deadbeef.js");
    expect(reload).not.toHaveBeenCalled();
  });

  it("ignorerer scripts der ikke er Next-chunks", () => {
    armScript();
    fireScriptError("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js");
    fireScriptError("https://www.googletagmanager.com/gtm.js");
    expect(reload).not.toHaveBeenCalled();
  });

  it("ignorerer fejl fra andre elementer end scripts", () => {
    // Et billede der 404'er må ikke genindlæse siden.
    armScript();
    const img = document.createElement("img");
    Object.defineProperty(img, "src", { value: "/_next/static/media/x.png", configurable: true });
    const ev = new Event("error");
    Object.defineProperty(ev, "target", { value: img, configurable: true });
    window.dispatchEvent(ev);
    expect(reload).not.toHaveBeenCalled();
  });

  it("genindlæser ikke hvis sessionStorage er utilgængelig", () => {
    // Privat browsing kan kaste. Uden løkke-sikring tør vi ikke genindlæse.
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blokeret");
    });
    armScript();
    fireScriptError("https://shelterdk.dk/_next/static/chunks/webpack-deadbeef.js");
    expect(reload).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("er syntaktisk gyldig og selvindpakket", () => {
    // Fanger tastefejl i strengen, som ellers først ville vise sig i browseren.
    expect(() => new Function(STALE_BUILD_RECOVERY_SCRIPT)).not.toThrow();
    expect(STALE_BUILD_RECOVERY_SCRIPT.startsWith("(function()")).toBe(true);
    expect(STALE_BUILD_RECOVERY_SCRIPT.trimEnd().endsWith("})();")).toBe(true);
  });
});
