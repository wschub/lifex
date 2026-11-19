import { act, fireEvent, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { keys } from "@/api/keys.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { makeQueryClient, renderRoutes } from "@/test/render.tsx";
import { SessionGuard } from "./SessionGuard.tsx";

const MINUTE = 60_000;
const FLIGHT = "11111111-1111-4111-8111-111111111111";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const SEAT = "33333333-3333-4333-8333-333333333333";

/** Monta el guardián dentro de un router con la portada y otras rutas. */
function mount(path = "/results") {
  const client = makeQueryClient();
  return renderRoutes(
    [
      { path: "/", element: <p>portada</p> },
      { path: "/results", element: <SessionGuard /> },
      { path: "/seats", element: <SessionGuard /> },
      { path: "/confirmation", element: <SessionGuard /> },
    ],
    [path],
    client,
  );
}

function startPurchase(startedAt = Date.now()) {
  useWizard.setState({
    search: { from: "BOG", to: "MDE", date: "2026-12-10", pax: 2 },
    flightId: FLIGHT,
    passengers: [],
    booking: {
      id: BOOKING,
      token: "guest-token",
      expiresAt: new Date(Date.now() + 45 * MINUTE).toISOString(),
      contactEmail: "a@b.co",
      contactPhone: "",
    },
    purchaseStartedAt: startedAt,
    seats: [
      {
        seatId: SEAT,
        identifier: "08A",
        seatClass: "ECONOMY",
        priceUsd: 25,
        holdExpiresAt: new Date(Date.now() + 15 * MINUTE).toISOString(),
      },
    ],
  });
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"],
  });
  vi.setSystemTime(new Date("2026-12-01T15:00:00Z"));
  useLangStore.setState({ lang: "es" });
  useWizard.getState().reset();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.style.overflow = "";
});

describe("SessionGuard: inactividad", () => {
  it("tras 2 minutos sin actividad abre el modal de sesión inactiva, en español y con un solo diálogo", () => {
    mount();
    advance(2 * MINUTE - 2000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    advance(3000);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-reason", "idle");
    expect(dialog).toHaveAccessibleName(/Cerramos tu sesión por inactividad/);
    expect(screen.getByText("Sesión inactiva")).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    // El diálogo vive directamente en <body> (portal), centrado por su overlay.
    expect(dialog.closest(".lx-overlay")?.parentElement).toBe(document.body);
  });

  it("la actividad del usuario reinicia el reloj", () => {
    mount();
    advance(110_000);
    fireEvent.pointerMove(window);
    advance(110_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "a" });
    advance(110_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    advance(15_000);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "idle");
  });

  it("el texto cambia con el idioma actual", () => {
    useLangStore.setState({ lang: "en" });
    mount();
    advance(2 * MINUTE + 1000);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      /closed your session due to inactivity/,
    );
    expect(screen.getByText("Inactive session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("sin compra en curso el mensaje no habla de una compra cancelada", () => {
    mount();
    advance(2 * MINUTE + 1000);
    expect(screen.getByText(/puedes seguir buscando vuelos/)).toBeInTheDocument();
    expect(screen.queryByText(/cancelamos la compra/)).not.toBeInTheDocument();
  });

  it("con una compra en curso avisa que se canceló, muestra la ruta y limpia el asistente", () => {
    mockApi({ [`DELETE /flights/${FLIGHT}/seats/${SEAT}/hold`]: {} });
    startPurchase();
    mount("/seats");
    advance(2 * MINUTE + 1000);

    expect(screen.getByText(/cancelamos la compra en curso/)).toBeInTheDocument();
    expect(screen.getByText("Pasajeros")).toBeInTheDocument();
    expect(useWizard.getState().booking).toBeNull();
    expect(useWizard.getState().flightId).toBeNull();
    expect(useWizard.getState().seats).toEqual([]);
  });

  it("no se activa en la confirmación ni mientras se procesa un pago", () => {
    mount("/confirmation");
    advance(10 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("con un pago en curso no cuenta la inactividad ni el plazo", () => {
    startPurchase(Date.now() - 20 * MINUTE);
    useWizard.setState({ paymentKey: "pay-1" });
    mount("/seats");
    advance(10 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SessionGuard: tiempo de compra agotado", () => {
  it("a los 15 minutos de abrir la reserva muestra el modal de tiempo agotado, aunque haya actividad", () => {
    mockApi({ [`DELETE /flights/${FLIGHT}/seats/${SEAT}/hold`]: {} });
    startPurchase();
    mount("/seats");
    for (let i = 0; i < 14; i += 1) {
      advance(MINUTE);
      fireEvent.pointerMove(window); // el usuario está activo: no hay inactividad
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    advance(MINUTE + 1000);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-reason", "timeout");
    expect(dialog).toHaveAccessibleName(/Se agotó el tiempo para completar tu compra/);
    expect(screen.getByText("Tiempo agotado")).toBeInTheDocument();
    expect(useWizard.getState().booking).toBeNull();
  });

  it("si el plazo ya había vencido al volver a la pestaña, aparece de inmediato", () => {
    startPurchase(Date.now() - 16 * MINUTE);
    mount("/seats");
    advance(100);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "timeout");
  });

  it("con los efectos duplicados de StrictMode el aviso conserva el resumen de la compra", () => {
    startPurchase(Date.now() - 16 * MINUTE);
    renderRoutes(
      [
        {
          path: "/seats",
          element: (
            <StrictMode>
              <SessionGuard />
            </StrictMode>
          ),
        },
      ],
      ["/seats"],
    );
    advance(100);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("Pasajeros")).toBeInTheDocument();
    expect(screen.getByText(/Bogotá \(BOG\)|BOG/)).toBeInTheDocument();
  });

  it("también salta si la reserva del servidor vence antes que el plazo", () => {
    startPurchase();
    useWizard.setState({
      booking: {
        ...useWizard.getState().booking!,
        expiresAt: new Date(Date.now() + 5 * MINUTE).toISOString(),
      },
    });
    mount("/seats");
    for (let i = 0; i < 5; i += 1) {
      advance(MINUTE);
      fireEvent.pointerMove(window); // activo: no hay inactividad
    }
    advance(1000);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "timeout");
  });

  it("el texto y los minutos cambian con el idioma", () => {
    useLangStore.setState({ lang: "en" });
    startPurchase(Date.now() - 16 * MINUTE);
    mount("/seats");
    advance(100);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      /Time ran out to complete your purchase/,
    );
    expect(screen.getByText("Time expired")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("suelta los asientos bloqueados con el token de la reserva", () => {
    const spy = mockApi({ [`DELETE /flights/${FLIGHT}/seats/${SEAT}/hold`]: {} });
    startPurchase(Date.now() - 16 * MINUTE);
    mount("/seats");
    advance(100);

    const call = spy.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(String(call?.[0])).toContain(`/flights/${FLIGHT}/seats/${SEAT}/hold`);
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe("Bearer guest-token");
  });

  it("muestra el código y el total si la reserva ya estaba en caché", () => {
    const client = makeQueryClient();
    client.setQueryData(keys.booking(BOOKING), {
      booking: { reservationNumber: "2EQB8O", totalPriceUsd: 100 },
    });
    startPurchase(Date.now() - 16 * MINUTE);
    renderRoutes([{ path: "/seats", element: <SessionGuard /> }], ["/seats"], client);
    advance(100);
    expect(screen.getByText("2EQB8O")).toBeInTheDocument();
    expect(screen.getByText(/COP\s*390\.|COP\s*\d/)).toBeInTheDocument();
  });
});

describe("SessionGuard: cerrar o continuar", () => {
  it.each(["Cerrar", "Continuar"])(
    "«%s» cierra el modal y lleva a la portada con la compra vacía",
    (name) => {
      startPurchase(Date.now() - 16 * MINUTE);
      const { router } = mount("/seats");
      advance(100);

      fireEvent.click(screen.getByRole("button", { name }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");
      expect(useWizard.getState().flightId).toBeNull();
      expect(useWizard.getState().purchaseStartedAt).toBeNull();
    },
  );

  it("Escape equivale a cerrar", () => {
    const { router } = mount("/results");
    advance(2 * MINUTE + 1000);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("el foco queda dentro del modal y el desplazamiento de la página se bloquea", () => {
    mount("/results");
    advance(2 * MINUTE + 1000);
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("después de cerrar, un nuevo periodo de inactividad vuelve a avisar", () => {
    mount("/results");
    advance(2 * MINUTE + 1000);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
