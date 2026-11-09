import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

// Leaflet kan ikke koere i jsdom; det er ikke det her handler om.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { ShelterMap } from "@/components/ShelterMap";

const hent = vi.fn();
beforeEach(() => {
  hent.mockReset();
  hent.mockResolvedValue({
    ok: true,
    json: async () => ({ stays: [{ id: 1, slug: "x", name: "Thy Glamping", type: "glamping",
      lat: 56.7, lng: 8.3, price_from: null, image_url: null,
      booking_url: "https://www.booking.com/hotel/dk/x.da.html", link_source: "booking_com" }] }),
  });
  vi.stubGlobal("fetch", hent);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const shelters = [{ id: "1", slug: "s", title: "S", location: "POINT(10 56)" }] as never[];

describe("kortet henter selv de betalte steder", () => {
  it("henter dem, naar siden ikke sender dem med", async () => {
    // Tolv kortsider skulle foer sende dem med, og én af dem huskede det.
    render(<ShelterMap shelters={shelters} />);
    await waitFor(() => expect(hent).toHaveBeenCalledWith("/api/map/stays"));
  });

  it("henter dem IKKE, naar siden allerede har dem", async () => {
    // Forsiden henter serverside og faar pins med i foerste maling; et ekstra
    // kald ville bare vaere en rundtur til det samme.
    render(<ShelterMap shelters={shelters} stays={[]} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(hent).not.toHaveBeenCalled();
  });

  it("viser lag-knappen med antallet, naar der kom noget", async () => {
    const { container } = render(<ShelterMap shelters={shelters} />);
    await waitFor(() => expect(container.textContent).toContain("Betalt overnatning"));
    expect(container.textContent).toContain("1");
  });

  it("viser ingen lag-knap, naar der ikke er nogen steder", async () => {
    hent.mockResolvedValue({ ok: true, json: async () => ({ stays: [] }) });
    const { container } = render(<ShelterMap shelters={shelters} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).not.toContain("Betalt overnatning");
  });

  it("vaelter ikke kortet, hvis kaldet fejler", async () => {
    // Et kort uden betalte pins er stadig et brugbart kort.
    hent.mockRejectedValue(new Error("nede"));
    const { container } = render(<ShelterMap shelters={shelters} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("div")).toBeTruthy();
    expect(container.textContent).not.toContain("Betalt overnatning");
  });
});

describe("egenskabssider fravaelger de betalte steder", () => {
  it("henter dem ikke, naar laget er fravalgt", async () => {
    // Opslaget skal ogsaa springes over, ikke kun visningen: et kald vi
    // alligevel kaster vaek er spildt egress paa hver kortvisning.
    render(<ShelterMap shelters={shelters} visBetalteOvernatninger={false} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(hent).not.toHaveBeenCalled();
  });

  it("viser ingen lag-knap, naar laget er fravalgt", async () => {
    const { container } = render(<ShelterMap shelters={shelters} visBetalteOvernatninger={false} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).not.toContain("Betalt overnatning");
  });

  it("fravalget vinder over en liste sendt med", async () => {
    // En side der baade fravaelger laget og sender pins med skal ende uden
    // pins. Ellers ville et fravalg vaere stille afhaengigt af kaldestedet.
    const pins = [{ id: 1, slug: "x", name: "Thy Glamping", type: "glamping", lat: 56.7, lng: 8.3,
      price_from: null, image_url: null, booking_url: "https://b.dk/x", link_source: "booking_com" }];
    const { container } = render(
      <ShelterMap shelters={shelters} stays={pins as never[]} visBetalteOvernatninger={false} />
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).not.toContain("Betalt overnatning");
  });

  it("viser laget som foer, naar intet er fravalgt", async () => {
    // Geografiske sider — forside, by, region, omraade, soegning — paastaar
    // ingen egenskab om det kortet viser, og dér bliver laget.
    const { container } = render(<ShelterMap shelters={shelters} />);
    await waitFor(() => expect(container.textContent).toContain("Betalt overnatning"));
  });
});
