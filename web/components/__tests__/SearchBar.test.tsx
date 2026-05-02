import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@/test/test-utils";
import { SearchBar } from "../SearchBar";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("viser region-dropdown med Hele Danmark som default", () => {
    render(<SearchBar mode="home" />);
    const select = screen.getByLabelText(/vælg region/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("");
  });

  it("viser Jylland som valgt når initialRegion er Jylland", () => {
    render(<SearchBar mode="search" initialRegion="Jylland" />);
    const select = screen.getByLabelText(/vælg region/i);
    expect(select).toHaveValue("Jylland");
  });

  it("viser søgefelt", () => {
    render(<SearchBar mode="home" />);
    expect(screen.getByPlaceholderText(/søg område eller by/i)).toBeInTheDocument();
  });

  it("viser alle region-optioner", () => {
    render(<SearchBar mode="home" />);
    const select = screen.getByLabelText(/vælg region/i);
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(options).toContain("");
    expect(options).toContain("Jylland");
    expect(options).toContain("Sjælland og Øerne");
    expect(options).toContain("Fyn");
    expect(options).toContain("Bornholm");
  });

  it("bevarer region-side ved view-skift", async () => {
    render(
      <SearchBar
        mode="search"
        initialRegion="Jylland"
        filterBasePath="/danmark/jylland"
        view="split"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /kun kort/i }));
    expect(mockPush).toHaveBeenCalledWith("/danmark/jylland?view=map", { scroll: false });
  });
});
