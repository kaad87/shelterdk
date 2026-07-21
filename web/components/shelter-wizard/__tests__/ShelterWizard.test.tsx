import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { ShelterWizard } from "../ShelterWizard";

// Leaflet-kortet er tungt og kører ikke i jsdom — mock trinnet væk.
vi.mock("../steps/StepMap", () => ({ StepMap: () => <div data-testid="step-map" /> }));

describe("ShelterWizard", () => {
  it("bliver på trin 1 og viser fejl når navn/placering mangler", () => {
    render(<ShelterWizard />);
    expect(screen.getByText(/Trin 1 af 6/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /næste/i }));

    expect(screen.getByText(/Trin 1 af 6/i)).toBeInTheDocument();
    expect(screen.getByText(/navn er påkrævet/i)).toBeInTheDocument();
  });

  it("går videre til trin 2 når navn og placering er udfyldt", () => {
    render(<ShelterWizard />);

    fireEvent.change(screen.getByLabelText(/navn/i), {
      target: { value: "Skovhytten" },
    });
    fireEvent.change(screen.getByLabelText(/placering/i), {
      target: { value: "Gribskov" },
    });

    fireEvent.click(screen.getByRole("button", { name: /næste/i }));

    expect(screen.getByText(/Trin 2 af 6/i)).toBeInTheDocument();
  });

  // Hjælper: udfyld trin 1 og klik "Næste" n gange (trin 2-4 har ingen krav).
  function advanceFromStart(times: number) {
    fireEvent.change(screen.getByLabelText(/navn/i), {
      target: { value: "Skovhytten" },
    });
    fireEvent.change(screen.getByLabelText(/placering/i), {
      target: { value: "Gribskov" },
    });
    for (let i = 0; i < times; i++) {
      fireEvent.click(screen.getByRole("button", { name: /næste/i }));
    }
  }

  it("blokerer på booking-trinnet når booking ønskes men vilkår ikke er accepteret", () => {
    render(<ShelterWizard />);
    advanceFromStart(4); // → trin 5 (Booking, index 4)
    expect(screen.getByText(/Trin 5 af 6/i)).toBeInTheDocument();

    // Første checkbox = "vil gerne aktivere booking"; accept-checkboxen lades urørt.
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /næste/i }));

    expect(screen.getByText(/Trin 5 af 6/i)).toBeInTheDocument();
    expect(screen.getByText(/acceptere samarbejdsvilkårene/i)).toBeInTheDocument();
  });

  it("blokerer submit på gennemse-trinnet når email mangler", () => {
    render(<ShelterWizard />);
    advanceFromStart(5); // booking urørt (wantsBooking=false) → trin 6 (Gennemse, index 5)
    expect(screen.getByText(/Trin 6 af 6/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send ansøgning/i }));

    expect(screen.getByText(/Email er påkrævet/i)).toBeInTheDocument();
  });
});
