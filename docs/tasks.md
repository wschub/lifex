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
- [x] El frontend lo consume con un alias (`@lifex/shared` → `../shared/src/index.ts`).

## 12. Frontend (`lifex/frontend/`)
- [x] Vite + React + TypeScript + shadcn/ui (solo dashboard) + Zustand (estado de UI) + TanStack Query (estado de servidor,
      incluida la sincronización con eventos WS vía `queryClient.setQueryData`) + TanStack Table.
- [x] Estructura de carpetas (decidida por el usuario): `frontend/web` (proyecto Vite de la web pública, URL `/`),
      `frontend/dashboard` (proyecto Vite de login + panel, URL `/dashboard`) y `frontend/public` (activos
      compartidos). Ambos comparten los contratos de `shared/` por alias; se despliegan juntos con
      `npm run build` + `npm start` en `frontend/` (`server.mjs`).
- [x] Guard de rutas del dashboard basado en los permisos devueltos por `GET /auth/me`.
- [x] Cliente WS con reconexión + pedido de snapshot al reconectar.
- [x] Selector de idioma (es/en) en la web (el dashboard es solo en español) que también activa la conversión USD→COP con `IATA_TRM`.
- [x] Logo definitivo en la app y en las dos plantillas de correo (PNG vertical con eslogan, `APP_URL`).

## 12.1 Precios dinámicos, ofertas y flota (HU5)
- [x] Servicio de dominio `dynamic-price.ts` (primer ticket +20 %, promedio +5 %, +0,5 % por hora en las
      últimas 72 h con tope a 2 h nacional / 5 h internacional, multiplicador de Business ×3).
- [x] Precio vigente en `GET /flights`, `GET /flights/:id` y el mapa de asientos; se congela al bloquear el asiento.
- [x] Tras cada compra exitosa se recalculan asientos disponibles, ocupación y promedios por clase.
- [x] `GET /flights/offers`: 5 nacionales + 5 internacionales, sin rutas repetidas, ventana 8–30 días; el
      descuento (`OFFER_DISCOUNT_PERCENTAGE`) es excluyente con el precio dinámico.
- [x] `aircraft.description` / `descriptionEs` y flota 787-8, 787-9, 737 MAX 8 y A320neo en el seed.
- [x] Reglas documentadas en HU5 (`docs/user-stories-acceptance-criteria.md`).

## Pendientes
- [ ] **Cookie de refresh en Railway:** con `COOKIE_SAME_SITE=strict` solo funciona si el frontend y la API
      comparten sitio. Si van en dominios distintos hay que usar `COOKIE_SAME_SITE=none` (con cookie `Secure`, que exige HTTPS)
      y **crear la variable en Railway al desplegar** (acordarse de crearla en el servicio de la API).
- [x] **Imágenes de ciudades:** viven en `frontend/public/img/destinations/` y la BD guarda solo el nombre del
      archivo (`cities.imageName`, ej. `medellin.jpg`); el frontend arma la ruta `/img/destinations/<nombre>`.
- [ ] **Convertir las imágenes a WebP** (recordárselo al usuario antes del despliegue). Al convertir, cambiar la extensión en `cities.imageName`.
- [ ] **Web pública:** usar `priceEconomyUsd` / `priceBusinessUsd` / `offer` de `GET /flights` y mostrar las
      ofertas de la portada con `GET /flights/offers` (reemplaza los precios estimados actuales).
- [ ] **Alineación de tarifas** (Light / Classic / Flex y Business) con el precio dinámico, al terminar la v1
      del frontend. El equipaje y demás servicios son costos adicionales sobre el precio de la tarifa.
- [ ] Endpoint de ofertas: ya implementado en el backend (`GET /flights/offers`); falta consumirlo en el front.
- [ ] **Habilitar tickets con ida y vuelta.** Hoy la web y la reserva trabajan con un solo vuelo (solo ida; el
      selector "Ida y vuelta" de la portada no está activo). Implica: búsqueda con fecha de regreso, elegir dos
      vuelos (ida y regreso), asientos de los dos tramos, precio de cada tramo con las reglas de HU5, una sola
      reserva con dos vuelos y un boleto por pasajero y tramo, y correos que los muestren. El modelo ya parte de
      que **una orden tiene uno o varios pasajeros y cada pasajero puede tener uno o varios tickets en la misma
      compra** (ida y regreso): el ajuste es mover el vuelo y el asiento del nivel de la orden/pasajero al nivel
      del tramo (ticket), porque hoy la orden referencia un solo vuelo. Las pestañas por tramo ya están en el
      prototipo.
- [ ] **Origen y destino con autocompletar** (una vez habilitado el tab de ida y vuelta): los dos campos filtran
      mientras se escribe, por código de aeropuerto (IATA) o por nombre de ciudad, en español e inglés.
- [ ] **Solo ida deshabilita la fecha de regreso** (una vez habilitado el tab de ida y vuelta).
- [ ] **Solo adultos:** quitar los niños (hoy `passengerType` admite `ADULT` y `CHILD`). Es un cambio chico:
      el selector de pasajeros y la página de pasajeros dejan solo adultos, y el backend/`shared/` rechazan `CHILD`.
- [ ] **Plantillas de correo nuevas** (ejemplo en la carpeta local `FRONTEND-WEB/Modal-template-mail/template-notificacion.html`, que **no** está en el repo,
      con el logo `lifex-email-logo-white.png` de esa carpeta). Reemplazan el diseño actual de
      `ticket-confirmation` y `flight-status-change` (mismo renderer `renderEmail()`). Variables del ejemplo:
      `SUBJECT`, `PREHEADER`, `FIRST_NAME`, `MESSAGE_PRIMARY`, `MESSAGE_SECONDARY`, `DETAIL_1_LABEL/VALUE`,
      `DETAIL_2_LABEL/VALUE`, `INFO_LABEL/VALUE`, `NOTE`, `CTA_LABEL`, `CTA_URL`. Decidir cómo mapean los datos del
      boleto y del aviso de vuelo a esos campos, copiar el logo a `frontend/public/mail/` y armar su URL con
      `APP_URL` (hoy el ejemplo trae `https://TU-DOMINIO/email/...`).
- [ ] **Modal de sesión** (ejemplo en la carpeta local `FRONTEND-WEB/Modal-template-mail/modal-sesion.html`, es/en; el modal se extrae de ahí cuando se vaya a implementar). Dos variantes:
      **sesión inactiva** (el usuario deja la web quieta y la sesión expira) y **tiempo excedido** (vence el tiempo
      para hacer la compra: `expiresAt` de la reserva y/o el bloqueo del asiento `MAX_SEAT_LOCK_TIME`). Botones
      "Continuar" y "Ayuda". Debe aparecer en la web pública (checkout) con el mismo diseño, liberar el asiento y
      llevar de vuelta a la selección; probar los casos de borde de la Tarea 11 (bloqueo vencido en `/payment`).

## 13. Documentación final
- [x] `docs/ia.md`, `docs/architecture.md`, `docs/user-stories-acceptance-criteria.md`,
      `docs/seed-plan.md` y `README.md` actualizados con el backend implementado.
- [ ] Completar `docs/ia.md` (prompts y refactors) y verificar las instrucciones de ejecución del README
      cuando exista el frontend.
