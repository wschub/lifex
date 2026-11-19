# Tareas de implementación

Checklist para el agente que construye el código, agrupado por capa y módulo, siguiendo la convención de
`backend/docs/ADDING-A-MODULE.md` (de dentro hacia fuera: entidad → repositorio → caso de uso → permisos →
esquema → controlador → tabla → adaptador → rutas → mensajes → composición).

**Estado:** backend y `shared/` completos (`npm run verify` en verde: lint, formato, tipos, test de
arquitectura y 625 pruebas). Pendiente: frontend y cierre de documentación.

## 0. Base del repositorio
- [x] Raíz del proyecto en `lifex/`.
- [x] Scaffold (auth, users, roles, permisos, tests, prisma) en `lifex/backend/`.
- [x] `lifex/frontend/`, `lifex/shared/`, `lifex/docs/` y `lifex/README.md`.
- [x] `npm run verify` del backend pasa.
- [x] Base de datos y proyecto de Docker Compose llamados `lifex` (`name: lifex` en `docker-compose.yml`).

## 1. Catálogo (`backend/src/modules/catalog/`)
- [x] Entidades/tipos: `Country`, `City`, `Airport`, `LuggageType` (la aeronave la usan el seed y los vuelos).
- [x] Repositorio de solo lectura (el catálogo se llena por seed).
- [x] Tablas: `countries`, `cities`, `airports`, `aircraft`, `luggage_type`.
- [x] Endpoints públicos: `GET /catalog/countries`, `GET /catalog/cities?country=`, `GET /catalog/luggage-types`.
- [x] Seed: ver `docs/seed-plan.md`.

## 2. Vuelos (`backend/src/modules/flights/`)
- [x] Entidad `ScheduledFlight` (valida `departure_date < arrival_date`, transiciones de estado) y lectura `FlightListing`.
- [x] Repositorio `ScheduledFlightRepository` (`search`, `findListing`, `findById`, `updateStatus`).
- [x] Casos de uso: `SearchFlights`, `GetFlight`, `ChangeFlightStatus` (requiere `flights:manage`).
- [x] Permisos: `flights:read`, `flights:manage`.
- [x] `ChangeFlightStatus` escribe `FlightStatusChanged` en `outbox_events` en la misma transacción.
- [x] Rutas: `GET /flights`, `GET /flights/:id` (públicas), `PATCH /flights/:id/status` (`flights:manage`).
- [x] Adaptador Prisma + migración.
- [x] `GET /auth/me` ya devuelve roles y permisos: no hizo falta extenderlo.

## 3. Inventario de asientos (`backend/src/modules/inventory/`)
- [x] Entidad `Seat` con máquina de estados `FREE → BLOCKED → PAYMENT_PENDING → RESERVED`.
- [x] `tryHold` atómico (un solo `UPDATE` condicional; devuelve `null` si no hubo fila afectada).
- [x] Casos de uso `HoldSeat` (409 si `tryHold` devuelve `null`; límite por sesión), `ReleaseSeat`,
      `ReleaseExpiredHolds` (job cada 30 s), `GetSeatMap` (snapshot + versión).
- [x] Puerto `RealtimeBroadcaster` (en `realtime/application/ports/`).
- [x] Rutas: `GET /flights/:id/seats`, `POST` y `DELETE /flights/:flightId/seats/:seatId/hold`.
- [x] Prueba de concurrencia: 50 solicitudes paralelas sobre el mismo asiento → exactamente 1 éxito (criterio 2.2).

## 4. Reservas y pasajeros (`backend/src/modules/bookings/`)
- [x] Entidades `Order`, `Passenger` (el comprador es el primer pasajero, `position = 0`).
- [x] `StartBooking` (orden `DRAFT` + JWT de sesión de invitado, `sub` = `order.id`, audiencia propia).
- [x] `SetPassengers` (pasajeros + asiento bloqueado + equipaje opcional + precio) y `GetBooking`.
- [x] Middleware de invitado (`requireGuest`, `requireBookingOwner`): el `sub` debe coincidir con la reserva de la URL.
- [x] Idioma del comprador (`Accept-Language`) guardado en `orders.locale`.

## 5. Pagos (`backend/src/modules/payments/`)
- [x] `Payment` nunca persiste el número completo de tarjeta (solo marca + últimos 4).
- [x] Puerto `PaymentGatewayPort` (`tokenize` + `charge`).
- [x] Adapter fake: Luhn, vencimiento, CVV y tarjetas de prueba (aprobada / rechazada / timeout).
- [x] `RequestPayment` (valida `Idempotency-Key`, transacción 1) y `ProcessPaymentRequest` (manejador del outbox, transacción 2).
- [x] Tabla `payments`, `orders.idempotencyKey` único + huella HMAC del cuerpo.
- [x] Pruebas: aprobado, rechazado, timeout con reintentos, misma clave con mismo/distinto cuerpo.

## 6. Tickets y notificaciones (`backend/src/modules/tickets/`)
- [x] `Ticket` (código único `LX…` para el QR) y `TicketLuggage`.
- [x] `IssueTickets` (tras el pago aprobado).
- [x] Regla Business Classic/Flex solo con asiento `BUSINESS`, validada en el dominio.
- [x] Puerto `NotificationPort` (confirmación de boleto + aviso de vuelo) y puerto `QrCodeGenerator`.
- [x] Adapter Brevo (`BrevoNotificationAdapter`) y adapter de log (sin `BREVO_API_KEY`).
- [x] Plantillas `ticket-confirmation` y `flight-status-change` (HTML + texto plano) en
      `backend/src/shared/notifications/templates/`, con renderer `renderEmail()`; `npm run build` las copia a `dist/`.
- [x] Parámetros de las plantillas armados en el adapter (`email-params.ts`): fecha y hora en hora de
      Colombia, clase traducida, total en COP (español) o USD (inglés).
- [x] Decisión: **un correo por ticket** (evento `TicketEmailRequested` por ticket).
- [x] `GET /tickets/:code/qr.png` (imagen QR para el correo) y `GET /bookings/:id/tickets`.
- [ ] Reemplazar el bloque `LOGO` de las plantillas cuando exista el asset definitivo (se hace con el frontend).

## 7. Aviso de vuelo cancelado o retrasado (HU4.6 y HU4.7)
- [x] Al pasar un vuelo a `CANCELLED` o `DELAYED`, `updateStatus` escribe un evento interno
      `FlightDisruptionEmailRequested` por cada orden `CONFIRMED` del vuelo, en la misma transacción.
- [x] Caso de uso `SendFlightDisruptionEmail` (un correo por orden, con todos sus pasajeros) y manejador en el outbox.
- [x] Pruebas: solo órdenes pagadas del vuelo, `DELAYED` y `CANCELLED`, `ACTIVE`/estado inválido no envía,
      fallo del proveedor → reintento sin duplicar y sin revertir el cambio de estado.

## 8. Tiempo real (`backend/src/modules/realtime/`)
- [x] Adaptador `ws` (`WsGateway`): autenticación en el *upgrade*, temas, heartbeat, protocolo subscribe/unsubscribe.
- [x] Snapshot + versión por vuelo (`scheduled_flights.eventVersion`) para resincronizar tras una reconexión.
- [x] Temas: `flight:{id}`, `flights:search`, `dashboard:{id}` (este exige `dashboard:read`).
- [x] Outbox: `ProcessOutbox` (backoff exponencial, `OUTBOX_MAX_ATTEMPTS`) cada 300 ms y `BroadcastFlightEvent`.

## 9. Dashboard (`backend/src/modules/dashboard/`)
- [x] `GET /dashboard/flights/:id` (métricas por estado y clase) y `GET /dashboard/flights?date=`, permiso `dashboard:read`.

## 10. Seed
- [x] `backend/prisma/seed.ts` según `docs/seed-plan.md` (`npm run db:seed`).

## 11. `shared/`
- [x] Paquete `@lifex/shared` (solo código fuente TypeScript, sin build): esquemas Zod de los DTOs
      (catálogo, vuelos, asientos, reservas, pagos, tickets, dashboard, auth, errores *problem details*) y
      catálogo de mensajes WebSocket (`SeatHeld`, `SeatReleased`, `SeatPaymentPending`, `SeatSold`,
      `BookingConfirmed`, `FlightStatusChanged`, mensajes de control, temas y protocolo del cliente).
- [x] Pruebas de contrato en `backend/tests/integration/lifex/contracts.test.ts`: las respuestas reales de la
      API (Postgres real) y los mensajes reales del WebSocket se validan contra estos esquemas.
- [ ] El frontend lo consumirá con un alias (`@lifex/shared` → `../shared/src/index.ts`).

## 12. Frontend (`lifex/frontend/`) — pendiente
- [ ] Vite + React + TypeScript + shadcn/ui + Zustand (estado de UI) + TanStack Query (estado de servidor,
      incluida la sincronización con eventos WS vía `queryClient.setQueryData`) + TanStack Table.
- [ ] Dos grupos de rutas con carga perezosa: `app/public/` (búsqueda, mapa de asientos, checkout, boleto) y
      `app/admin/` (login staff, dashboard), compartiendo cliente HTTP, tipos (`shared/`) y componentes.
- [ ] Guard de rutas de `app/admin/` basado en los permisos devueltos por `GET /auth/me`.
- [ ] Cliente WS con reconexión + pedido de snapshot al reconectar.
- [ ] Selector de idioma (es/en) que también activa la conversión USD→COP con `IATA_TRM`.
- [ ] Logo definitivo en la app y en las dos plantillas de correo.

## 13. Documentación final
- [x] `docs/ia.md`, `docs/architecture.md`, `docs/user-stories-acceptance-criteria.md`,
      `docs/seed-plan.md` y `README.md` actualizados con el backend implementado.
- [ ] Completar `docs/ia.md` (prompts y refactors) y verificar las instrucciones de ejecución del README
      cuando exista el frontend.
