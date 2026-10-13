import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";

// Kortet kræver Leaflet og en browser; det er ikke det her handler om.
vi.mock("@/components/naturophold/MapPicker", () => ({ MapPicker: () => null }));
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));

import { StayLocationPicker } from "@/components/naturophold/StayLocationPicker";

afterEach(cleanup);

function indsaet(tekst: string) {
  const onChange = vi.fn();
  const { container } = render(<StayLocationPicker lat="" lng="" onChange={onChange} />);
  const felter = container.querySelectorAll("input");
  const lat = felter[felter.length - 2];
  fireEvent.paste(lat, { clipboardData: { getData: () => tekst } });
  return { onChange, container };
}

describe("indsæt koordinater fra Google Maps", () => {
  it("deler et indsat par i de to felter", () => {
    const { onChange } = indsaet("55.924147, 12.296374");
    expect(onChange).toHaveBeenCalledWith("55.924147", "12.296374");
  });

  it("tager en hel Google Maps-adresse", () => {
    const { onChange } = indsaet("https://www.google.com/maps/@55.924147,12.296374,15z");
    expect(onChange).toHaveBeenCalledWith("55.924147", "12.296374");
  });

  it("retter ombyttede tal og siger til", () => {
    const { onChange, container } = indsaet("12.296374, 55.924147");
    expect(onChange).toHaveBeenCalledWith("55.924147", "12.296374");
    expect(container.textContent).toContain("byttet om");
  });

  it("advarer om et punkt uden for Danmark uden at afvise det", () => {
    const { onChange, container } = indsaet("52.5200, 13.4050");
    expect(onChange).toHaveBeenCalledWith("52.52", "13.405");
    expect(container.textContent).toContain("uden for Danmark");
  });

  it("lader browseren indsaette normalt, naar det ikke er koordinater", () => {
    // Ellers kunne man ikke indsaette et enkelt tal i feltet.
    const { onChange } = indsaet("55.92");
    expect(onChange).not.toHaveBeenCalled();
  });
});
