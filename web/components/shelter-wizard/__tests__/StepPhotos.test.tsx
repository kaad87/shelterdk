import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { StepPhotos } from "../steps/StepPhotos";

const noop = () => {};

function imgFile(name: string) {
  return new File([new Uint8Array([1])], name, { type: "image/jpeg" });
}

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

  it("uploader højst op til den resterende kapacitet ved multi-fil-valg", () => {
    const onAdd = vi.fn();
    // 4 allerede uploadet → kun plads til 1 mere.
    const existing = Array.from({ length: 4 }, (_, i) => ({
      path: `pending/${i}.jpg`,
      previewUrl: null,
      deleteToken: "t",
    }));
    const { container } = render(
      <StepPhotos
        photos={existing}
        uploading={false}
        error={null}
        onAdd={onAdd}
        onRemove={noop}
      />
    );
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [imgFile("a.jpg"), imgFile("b.jpg"), imgFile("c.jpg")] },
    });
    // 5 − 4 = 1: kun ét kald trods tre valgte filer.
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
