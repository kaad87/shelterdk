import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * sendBeacon returnerer false, når browseren nægter at køe payloaden — typisk
 * fordi køen er fuld, eller fordi siden er ved at forsvinde. Koden ignorerede
 * returværdien og vendte tilbage uanset, så fetch-faldbacken aldrig kørte, og
 * eventet var tabt uden spor.
 *
 * Målt på grej-blokken: 10 landinger med ?fra=shelter mod kun 8 registrerede
 * klik. Klikket sendes netop i det øjeblik siden navigerer væk, altså når
 * sendBeacon oftest fejler.
 */
function opsæt(beaconSvar: boolean | "kaster") {
  const beacon = vi.fn(() =>
    beaconSvar === "kaster" ? (() => { throw new Error("nej"); })() : beaconSvar
  );
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
  vi.stubGlobal("navigator", { sendBeacon: beacon });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Blob", class { constructor(public p: unknown[]) {} });
  vi.stubGlobal("document", { title: "t", referrer: "" });
  vi.stubGlobal("window", { location: { pathname: "/bedste/x", search: "?fra=shelter" }, dataLayer: [] });
  return { beacon, fetchMock };
}

describe("sendServerEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("bruger sendBeacon når den lykkes, og kalder ikke fetch", async () => {
    const { beacon, fetchMock } = opsæt(true);
    const { trackGearSuggestionClick } = await import("@/lib/tracking");
    trackGearSuggestionClick({ guideSlug: "taendstaal", shelterSlug: "s", reason: "r" });
    expect(beacon).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falder tilbage til fetch når sendBeacon returnerer false", async () => {
    const { beacon, fetchMock } = opsæt(false);
    const { trackGearSuggestionClick } = await import("@/lib/tracking");
    trackGearSuggestionClick({ guideSlug: "taendstaal", shelterSlug: "s", reason: "r" });
    expect(beacon).toHaveBeenCalledOnce();
    expect(fetchMock, "eventet var tabt — fetch-faldbacken kørte ikke").toHaveBeenCalledOnce();
  });

  it("falder tilbage til fetch når sendBeacon kaster", async () => {
    const { fetchMock } = opsæt("kaster");
    const { trackGearSuggestionClick } = await import("@/lib/tracking");
    trackGearSuggestionClick({ guideSlug: "taendstaal", shelterSlug: "s", reason: "r" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
