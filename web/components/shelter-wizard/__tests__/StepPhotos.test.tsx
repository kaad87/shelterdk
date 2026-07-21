import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { StepPhotos } from "../steps/StepPhotos";

const noop = () => {};

describe("StepPhotos", () => {
  it("viser 'Hoved'-badge på det første billede", () => {
    render(
      <StepPhotos
        photos={[
          { path: "pending/a.jpg", previewUrl: "blob:a", deleteToken: "t1" },
          { path: "pending/b.jpg", previewUrl: "blob:b", deleteToken: "t2" },
        ]}
        uploading={false}
        error={null}
        onAdd={noop}
        onRemove={noop}
      />
    );
    expect(screen.getByText("Hoved")).toBeInTheDocument();
  });

  it("viser synlig fejl når error er sat", () => {
    render(
      <StepPhotos
        photos={[]}
        uploading={false}
        error="Upload fejlede — prøv igen"
        onAdd={noop}
        onRemove={noop}
      />
    );
    expect(screen.getByText(/Upload fejlede — prøv igen/i)).toBeInTheDocument();
  });
});
