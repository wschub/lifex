import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import * as chunkReload from "@/lib/chunk-reload.ts";
import { RouteError } from "./RouteError.tsx";

/** Una ruta cuyo módulo perezoso falla, como tras un despliegue. */
function renderFailingRoute(error: Error) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        errorElement: <RouteError />,
        lazy: async () => {
          throw error;
        },
      },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  sessionStorage.clear();
  useLangStore.setState({ lang: "es" });
  vi.restoreAllMocks();
});

describe("RouteError", () => {
  it("si falta un archivo de la versión anterior recarga la página una vez, sin mostrar el error feo", async () => {
    const reload = vi.spyOn(chunkReload, "reloadOnce").mockReturnValue(true);
    const { container } = renderFailingRoute(
      new TypeError(
        "Failed to fetch dynamically imported module: https://x.app/assets/Home-kzseercE.js",
      ),
    );
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("Unexpected");
  });

  it("si ya se recargó hace poco muestra un aviso con un botón para recargar (sin bucle)", async () => {
    sessionStorage.setItem("lx-chunk-reload", String(Date.now()));
    vi.spyOn(chunkReload, "reloadOnce").mockReturnValue(false);
    renderFailingRoute(
      new TypeError("Failed to fetch dynamically imported module: /assets/Home.js"),
    );
    expect(await screen.findByText(/Hay una versión nueva de Lifex/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recargar" })).toBeInTheDocument();
  });

  it("cualquier otro error muestra un aviso del sitio con un botón para ir al inicio", async () => {
    const reload = vi.spyOn(chunkReload, "reloadOnce");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderFailingRoute(new Error("Cannot read properties of undefined"));
    expect(await screen.findByText("Algo salió mal. Inténtalo de nuevo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al inicio" })).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
