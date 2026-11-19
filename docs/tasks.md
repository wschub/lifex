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
- [x] Logo definitivo en las plantillas (PNG vertical con eslogan vía `APP_URL`).

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
- [x] `backend/src/cli/seed.ts` según `docs/seed-plan.md` (`npm run db:seed`; en producción `node dist/cli/seed.js`).

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
- [x] **Cookie de refresh en Railway** (resuelto con el proxy de mismo origen: `COOKIE_SAME_SITE=lax`; ver `docs/deploy-railway.md`): con `COOKIE_SAME_SITE=strict` solo funciona si el frontend y la API
      comparten sitio. Si van en dominios distintos hay que usar `COOKIE_SAME_SITE=none` (con cookie `Secure`, que exige HTTPS)
      y **crear la variable en Railway al desplegar** (acordarse de crearla en el servicio de la API).
- [x] **Imágenes de ciudades:** viven en `frontend/public/img/destinations/` y la BD guarda solo el nombre del
      archivo (`cities.imageName`, ej. `medellin.jpg`); el frontend arma la ruta `/img/destinations/<nombre>`.
- [ ] **Convertir las imágenes a WebP** (recordárselo al usuario antes del despliegue). Al convertir, cambiar la extensión en `cities.imageName`.
- [x] **Web pública:** usar `priceEconomyUsd` / `priceBusinessUsd` / `offer` de `GET /flights` y mostrar las
      ofertas de la portada con `GET /flights/offers` (reemplaza los precios estimados actuales).
- [ ] **Alineación de tarifas** (Light / Classic / Flex y Business) con el precio dinámico, al terminar la v1
      del frontend. El equipaje y demás servicios son costos adicionales sobre el precio de la tarifa.
- [x] Endpoint de ofertas (`GET /flights/offers`) consumido en la portada.
- [ ] **Habilitar tickets con ida y vuelta.** Hoy la web y la reserva trabajan con un solo vuelo (solo ida; el
      selector "Ida y vuelta" de la portada no está activo). Implica: búsqueda con fecha de regreso, elegir dos
      vuelos (ida y regreso), asientos de los dos tramos, precio de cada tramo con las reglas de HU5, una sola
      reserva con dos vuelos y un boleto por pasajero y tramo, y correos que los muestren. El modelo ya parte de
      que **una orden tiene uno o varios pasajeros y cada pasajero puede tener uno o varios tickets en la misma
      compra** (ida y regreso): el ajuste es mover el vuelo y el asiento del nivel de la orden/pasajero al nivel
      del tramo (ticket), porque hoy la orden referencia un solo vuelo. Las pestañas por tramo ya están en el
      prototipo.
- [x] **Origen y destino con autocompletar** (`AirportCombobox`, patrón combobox de ARIA): los dos campos muestran todos los
      aeropuertos, nacionales e internacionales (agrupados), y filtran mientras se escribe por código IATA o por ciudad (español
      o inglés, sin tildes); teclado (flechas, Enter, Tab, Escape) y el destino excluye el origen. Mismo aspecto que el select anterior.
- [ ] **Solo ida deshabilita la fecha de regreso** (una vez habilitado el tab de ida y vuelta).
- [x] **Niños en la reserva:** se conservan (`passengerType` sigue admitiendo `ADULT` y `CHILD`); no hay cambio.
- [ ] **Plantillas de correo nuevas** (ejemplo en la carpeta local `FRONTEND-WEB/Modal-template-mail/template-notificacion.html`, que **no** está en el repo,
      con el logo `lifex-email-logo-white.png` de esa carpeta). Reemplazan el diseño actual de
      `ticket-confirmation` y `flight-status-change` (mismo renderer `renderEmail()`). Variables del ejemplo:
      `SUBJECT`, `PREHEADER`, `FIRST_NAME`, `MESSAGE_PRIMARY`, `MESSAGE_SECONDARY`, `DETAIL_1_LABEL/VALUE`,
      `DETAIL_2_LABEL/VALUE`, `INFO_LABEL/VALUE`, `NOTE`, `CTA_LABEL`, `CTA_URL`. Decidir cómo mapean los datos del
      boleto y del aviso de vuelo a esos campos, copiar el logo a `frontend/public/mail/` y armar su URL con
      `APP_URL` (hoy el ejemplo trae `https://TU-DOMINIO/email/...`).
- [x] **Modal de sesión** (`frontend/web/src/app/public/session/`), basado en el ejemplo de diseño local
      (`FRONTEND-WEB/Modal-template-mail/modal-sesion.html`; el logo blanco salió de ahí a `frontend/public/logo/lifex-reversed.svg`).
      Dos motivos, en el idioma actual (es/en) y centrado en pantalla:
      - **Sesión inactiva:** `idleTimeoutMinutes` (`WEB_IDLE_TIMEOUT_MINUTES`, 2 min) sin actividad (ratón, teclado, scroll,
        toque) en **cualquier sección** del sitio público.
      - **Tiempo de compra agotado:** `maxSeatLockMinutes` (`MAX_SEAT_LOCK_TIME`, 15 min) desde que se abre la reserva
        (`purchaseStartedAt`), o antes si la reserva del servidor vence (`booking.expiresAt`).
      Al dispararse se descarta la compra (se sueltan los asientos bloqueados y se limpia el asistente) y **Cerrar**,
      **Continuar** o Escape llevan a la portada para empezar de cero. Se pausa en `/confirmation` y mientras se procesa un
      pago (`paymentKey`). Si no hay compra en curso, el texto de inactividad no habla de una compra cancelada.
      Decisión: se quitó del ejemplo el texto "tu reserva se conserva" y el botón "Solicitar ayuda", porque la compra se
      reinicia; los botones usan los `.btn` del sitio.

## 12.1b Panel de administración (dashboard)
- [x] **Dashboard:** indicadores (vuelos del día, ocupación, tickets vendidos, ingresos, vuelos con novedades) y tres gráficas
      (vuelos por hora, ocupación por tipo de ruta y clase, vuelos por estado) con `GET /dashboard/overview`.
- [x] **Tabla de vuelos del día** con paginación del servidor y filtros de origen y destino con autocompletar (como la web pública).
- [x] **Sección «Vuelos»** (`/dashboard/vuelos`): todos los vuelos, nacionales e internacionales, con filtros de origen, destino y
      fecha y paginación; la ven `ADMIN` y `ADMIN_VIEWER`. (La lista anterior se cortaba en los primeros 100 vuelos y por eso
      no aparecían los internacionales; ahora `GET /dashboard/flights` pagina y filtra en el servidor.)
- [x] **Avisos de cancelación o retraso:** a cada reserva confirmada del vuelo se le envía un correo cuyo asunto dice
      «Cancelación…» o «Retraso…», con un texto corto y diplomático que pide estar pendiente del correo (HU4.6).

## 12.2 Despliegue y operación (Railway)
- [ ] **Subir los commits pendientes** (`git push`) y comprobar la primera ejecución de los workflows en la pestaña Actions
      (`backend-ci`, `web-ci`, `dashboard-ci`).
- [ ] **Cargar los datos en Railway** desde la consola del backend (`node dist/cli/seed.js …`; ver `docs/deploy-railway.md`):
      catálogo, roles, vuelos y los dos usuarios con `SEED_PASSWORD`. Comprobar el tamaño del volumen (~0,93 GB con el rango completo).
- [ ] **Crear el SUPER_ADMIN** (`node dist/cli/create-admin.js …`) si hace falta.
- [ ] **Rotar la contraseña de Postgres de Railway:** la URL con la contraseña se pegó en el chat; cambiarla y actualizar las variables.
- [ ] **Recorrido de punta a punta en producción:** compra con la tarjeta de prueba, correo con logo y QR, login y dashboard en vivo.
- [ ] **Correos de producción:** remitente en un dominio propio con SPF/DKIM autenticados en Brevo (hoy se prueba con un Gmail);
      decidir si se mantiene sin restricción de IPs en Brevo (las IPs de salida de Railway cambian).
- [ ] **Limpieza:** borrar las ramas `backend`, `frontend/web` y `frontend/dashboard` (ya integradas en `main`) y los restos del
      andamiaje (`backend/README.en.md`, `backend/.scaffold.json`, `backend/docs/`) si ya no se necesitan.
- [ ] **Escala del seed:** 4,4 millones de filas de asientos; si el volumen crece, evaluar crear los asientos bajo demanda o
      particionar la tabla. Vigilar `GET /flights/offers` (hoy ~0,15 s).
- [ ] **Pruebas del servidor del frontend:** corren con `--test-force-exit` porque queda un handle abierto; diagnosticarlo.
- [ ] **Imágenes de ciudades:** faltan 17 fotos (lista en `docs/seed-plan.md`) y la conversión a WebP.

## 13. Documentación final
- [x] `docs/ia.md`, `docs/architecture.md`, `docs/user-stories-acceptance-criteria.md`,
      `docs/seed-plan.md` y `README.md` actualizados con el backend implementado.
- [ ] Completar `docs/ia.md` (prompts y refactors) y verificar las instrucciones de ejecución del README
      cuando exista el frontend.
