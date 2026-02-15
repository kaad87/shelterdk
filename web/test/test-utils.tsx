import { render, type RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });
}

export * from "@testing-library/react";
export { customRender as render };
