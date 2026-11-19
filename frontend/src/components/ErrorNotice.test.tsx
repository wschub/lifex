import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors.ts";
import { useLangStore } from "@/i18n/i18n.ts";
import { ErrorNotice } from "./ErrorNotice.tsx";

beforeEach(() => useLangStore.setState({ lang: "es" }));

describe("ErrorNotice", () => {
  it("avisa de un fallo de red y deja reintentar", async () => {
    const onRetry = vi.fn();
    render(<ErrorNotice error={new ApiError(0, "NETWORK")} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No hay conexión con el servidor");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("avisa de un 429", () => {
    render(<ErrorNotice error={new ApiError(429, "TOO_MANY_REQUESTS")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Demasiados intentos");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("muestra el detalle traducido que manda el backend", () => {
    const problem = {
      type: "about:blank" as const,
      title: "Conflict",
      status: 409,
      code: "SEAT_UNAVAILABLE",
      detail: "Ese asiento ya no está disponible.",
    };
    render(<ErrorNotice error={new ApiError(409, "SEAT_UNAVAILABLE", problem)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ese asiento ya no está disponible.");
  });

  it("usa el texto en inglés cuando el idioma es inglés", () => {
    useLangStore.setState({ lang: "en" });
    render(<ErrorNotice error={new Error("x")} onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
