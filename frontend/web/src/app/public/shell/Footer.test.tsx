import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { renderPage } from "@/test/render.tsx";
import { SiteFooter } from "./Footer.tsx";

describe("SiteFooter", () => {
  beforeEach(() => useLangStore.setState({ lang: "es" }));

  it("muestra solo el copyright, sin avisos de datos de ejemplo", () => {
    const { container } = renderPage(<SiteFooter />);
    expect(screen.getByText("© 2026 lifex.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ejemplo|sample/i);
  });

  it("en inglés tampoco menciona datos de ejemplo", () => {
    useLangStore.setState({ lang: "en" });
    const { container } = renderPage(<SiteFooter />);
    expect(screen.getByText("© 2026 lifex.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ejemplo|sample/i);
  });
});
