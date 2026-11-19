import { act, fireEvent, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keys } from "@/api/keys.ts";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { makeQueryClient, renderRoutes } from "@/test/render.tsx";
import { SessionGuard } from "./SessionGuard.tsx";

const MINUTE = 60_000;
const FLIGHT = "11111111-1111-4111-8111-111111111111";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const SEAT = "33333333-3333-4333-8333-333333333333";
const DELETE_HOLD = `DELETE /flights/${FLIGHT}/seats/${SEAT}/hold`;

/** Monta el guardián en una de las rutas de la compra y deja la portada para comprobar la redirección. */
function mount(path = "/results", client = makeQueryClient()) {
  const guard = <SessionGuard />;
  return renderRoutes(
    [
      { path: "/", element: <p>portada</p> },
      ...["/results", "/passengers", "/customize", "/seats", "/payment", "/confirmation"].map(
        (route) => ({ path: route, element: guard }),
      ),
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
let step = 0;
/** Un movimiento real del puntero: cada llamada cambia de posición. */
const move = () => {
  step += 1;
  fireEvent.pointerMove(window, { clientX: step, clientY: step });
};

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

describe("inactividad (2 min): en cualquier sección menos /seats y /payment", () => {
  it.each(["/", "/results", "/passengers", "/customize"])(
    "tras 2 minutos sin actividad en %s abre el modal de sesión inactiva, en español y centrado en <body>",
    (path) => {
      mount(path === "/" ? "/results" : path);
      advance(2 * MINUTE - 2000);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      advance(3000);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("data-reason", "idle");
      expect(dialog).toHaveAccessibleName(/Tu sesión se cerrará por inactividad/);
      expect(screen.getByText("Sesión inactiva")).toBeInTheDocument();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(dialog.closest(".lx-overlay")?.parentElement).toBe(document.body);
    },
  );

  it("en /seats y /payment NO se activa: ahí solo manda el plazo de 15 minutos", () => {
    for (const path of ["/seats", "/payment"]) {
      useWizard.getState().reset();
      startPurchase();
      const view = mount(path);
      advance(10 * MINUTE);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("la actividad del usuario reinicia el reloj (movimiento real, teclado)", () => {
    mount();
    advance(110_000);
    move();
    advance(110_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "a" });
    advance(110_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    advance(15_000);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "idle");
  });

  it("los eventos de movimiento con el cursor quieto (generados por el navegador) no reinician el reloj", () => {
    mount();
    move(); // un movimiento real
    for (let i = 0; i < 20; i += 1) {
      advance(5000);
      fireEvent.pointerMove(window, { clientX: step, clientY: step }); // misma posición: no es actividad
    }
    // 100 s desde el último movimiento real + 20 s más: ya pasaron 2 minutos
    advance(25_000);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "idle");
  });

  it("el texto cambia con el idioma actual", () => {
    useLangStore.setState({ lang: "en" });
    mount();
    advance(2 * MINUTE + 1000);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      /Your session will close due to inactivity/,
    );
    expect(screen.getByText("Inactive session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("sin compra en curso el mensaje no habla de una compra", () => {
    mount();
    advance(2 * MINUTE + 1000);
    expect(screen.getByText(/Pulsa Continuar para seguir donde estabas/)).toBeInTheDocument();
    expect(screen.queryByText(/la compra empezará de cero/)).not.toBeInTheDocument();
  });

  it("con una compra en curso NO la descarta al abrirse: muestra la ruta y espera la decisión", () => {
    startPurchase();
    mount("/customize");
    advance(2 * MINUTE + 1000);

    expect(screen.getByText(/te dejamos donde estabas/)).toBeInTheDocument();
    expect(screen.getByText("Pasajeros")).toBeInTheDocument();
    expect(useWizard.getState().booking).not.toBeNull();
    expect(useWizard.getState().flightId).toBe(FLIGHT);
  });

  it("«Continuar» deja al usuario donde estaba, con la compra intacta, y el reloj vuelve a correr", () => {
    mockApi({ [DELETE_HOLD]: {} });
    startPurchase();
    const { router } = mount("/customize");
    advance(2 * MINUTE + 1000);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/customize");
    expect(useWizard.getState().booking).not.toBeNull();
    expect(useWizard.getState().seats[0]).not.toBeNull();
    advance(2 * MINUTE + 1000); // sigue inactivo: vuelve a avisar
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "idle");
  });

  it("Escape equivale a continuar (no destruye la compra por accidente)", () => {
    startPurchase();
    const { router } = mount("/customize");
    advance(2 * MINUTE + 1000);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/customize");
    expect(useWizard.getState().booking).not.toBeNull();
  });

  it("«Cerrar» descarta la compra, suelta los asientos y lleva a la portada", () => {
    const spy = mockApi({ [DELETE_HOLD]: {} });
    startPurchase();
    const { router } = mount("/customize");
    advance(2 * MINUTE + 1000);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(useWizard.getState().flightId).toBeNull();
    expect(useWizard.getState().purchaseStartedAt).toBeNull();
    const call = spy.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe("Bearer guest-token");
  });

  it("no se activa en la confirmación ni mientras se procesa un pago", () => {
    mount("/confirmation");
    advance(10 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("tiempo de compra agotado (15 min): solo en /seats y /payment", () => {
  it.each(["/seats", "/payment"])(
    "en %s, a los 15 minutos de abrir la reserva muestra el modal, aunque el usuario esté activo",
    (path) => {
      mockApi({ [DELETE_HOLD]: {} });
      startPurchase();
      mount(path);
      for (let i = 0; i < 14; i += 1) {
        advance(MINUTE);
        move();
      }
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      advance(MINUTE + 1000);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("data-reason", "timeout");
      expect(dialog).toHaveAccessibleName(/Se agotó el tiempo para completar tu compra/);
      expect(screen.getByText("Tiempo agotado")).toBeInTheDocument();
      expect(useWizard.getState().booking).toBeNull(); // la compra ya se descartó
    },
  );

  it("en las demás secciones no corre: la compra con plazo vencido espera hasta llegar a /seats", () => {
    startPurchase(Date.now() - 16 * MINUTE);
    const { router } = mount("/customize");
    advance(100);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useWizard.getState().booking).not.toBeNull();

    act(() => void router.navigate("/seats"));
    advance(100);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "timeout");
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
    advance(5 * MINUTE + 1000);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reason", "timeout");
  });

  it("con un pago en curso no cuenta el plazo", () => {
    startPurchase(Date.now() - 20 * MINUTE);
    useWizard.setState({ paymentKey: "pay-1" });
    mount("/payment");
    advance(10 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("al abrirse suelta los asientos bloqueados con el token de la reserva", () => {
    const spy = mockApi({ [DELETE_HOLD]: {} });
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
    mount("/seats", client);
    advance(100);
    expect(screen.getByText("2EQB8O")).toBeInTheDocument();
    expect(screen.getByText(/COP\s*\d/)).toBeInTheDocument();
  });

  it.each(["Cerrar", "Continuar"])(
    "«%s» cierra el modal y lleva a la portada con la compra vacía (empezar de cero)",
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

  it("Escape lleva a la portada (no hay compra que conservar)", () => {
    startPurchase(Date.now() - 16 * MINUTE);
    const { router } = mount("/payment");
    advance(100);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("el foco queda dentro del modal y el desplazamiento de la página se bloquea", () => {
    startPurchase(Date.now() - 16 * MINUTE);
    mount("/seats");
    advance(100);
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });
});
