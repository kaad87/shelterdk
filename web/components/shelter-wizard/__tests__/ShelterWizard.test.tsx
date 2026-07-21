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
});
