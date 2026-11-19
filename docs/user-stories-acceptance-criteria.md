# Historias de usuario y criterios de aceptación (no negociables)

Cada criterio de esta tabla debe tener una prueba automatizada (unitaria, de integración o de aceptación,
según el nivel que le corresponda). Un criterio sin prueba se considera no cumplido, aunque funcione
manualmente.

---

## HU1 — Búsqueda y filtro de vuelos

**Como** usuario del sistema, **quiero** buscar vuelos por origen, destino y fecha, **para** visualizar los
vuelos disponibles con sus tarifas y horarios.

| # | Criterio | Tipo de prueba |
|---|---|---|
| 1.1 | `GET /flights?from=&to=&date=` devuelve solo vuelos `ACTIVE`, `DELAYED` o `SOLD_OUT` cuya fecha coincida; nunca `FINALIZED`. | Aceptación |
| 1.2 | Cada resultado incluye tarifa base, horario, clase disponible y `num_available_seats`. | Aceptación |
| 1.3 | Si no hay vuelos para la búsqueda, la respuesta es `200` con lista vacía, no `404`. | Aceptación |
| 1.4 | Si el admin cambia el `status` de un vuelo (ej. a `CANCELLED`) mientras un cliente tiene la pantalla de resultados abierta, el cliente recibe el cambio por WebSocket (tema `flights:search`) sin recargar. | Aceptación (con 2 clientes WS simulados) |
| 1.5 | Un vuelo con `num_available_seats = 0` se muestra marcado como agotado, no se oculta de la lista. | Unitaria (mapeo a DTO público) |

## HU2 — Selección y bloqueo temporal de asientos

**Como** cliente, **quiero** seleccionar un asiento en el mapa interactivo, **para** reservarlo temporalmente
mientras completo mis datos de pago.

| # | Criterio | Tipo de prueba |
|---|---|---|
| 2.1 | Al bloquear un asiento `FREE`, pasa a `BLOCKED` con `hold_expires_at = now() + MAX_SEAT_LOCK_TIME`. | Unitaria (caso de uso) |
| 2.2 | Si dos clientes intentan bloquear el mismo asiento al mismo tiempo, exactamente uno recibe éxito (`200`) y el otro `409 Conflict`. Prueba de concurrencia real: 50 intentos paralelos sobre el mismo asiento, 1 solo ganador. | Integración (BD real) |
| 2.3 | Al bloquear un asiento, todos los demás clientes conectados al tema `flight:{id}` reciben el evento `SeatHeld` en menos de 1 segundo (entorno de prueba local). | Aceptación (2 clientes WS) |
| 2.4 | Un asiento `BLOCKED` cuyo `hold_expires_at` ya pasó se puede volver a bloquear como si estuviera `FREE`, sin esperar al job periódico (expiración perezosa). | Integración |
| 2.5 | El job periódico libera asientos `BLOCKED` vencidos en un máximo de 30 segundos tras la expiración y emite `SeatReleased` por WebSocket. | Integración (con reloj controlado / `vi.useFakeTimers`) |
| 2.6 | Una sesión no puede mantener bloqueados más de N asientos a la vez (anti-acaparamiento; N configurable). | Unitaria |

## HU3 — Confirmación y procesamiento de la reserva

**Como** cliente, **quiero** confirmar la compra con datos ficticios de pago, **para** obtener el boleto con
mi código de reserva único.

| # | Criterio | Tipo de prueba |
|---|---|---|
| 3.1 | `POST /bookings/:id/payments` sin header `Idempotency-Key` responde `400`. | Aceptación |
| 3.2 | Repetir la misma petición con la misma `Idempotency-Key` y el mismo cuerpo devuelve la respuesta original, sin crear un segundo pago ni cobrar dos veces. | Integración |
| 3.3 | La misma `Idempotency-Key` con un cuerpo distinto responde `422`. | Aceptación |
| 3.4 | Durante el procesamiento, el asiento está en `PAYMENT_PENDING` y el job de expiración de bloqueos lo ignora (no lo libera aunque pase el tiempo de hold). | Integración |
| 3.5 | Pago aprobado (tarjeta de prueba válida): asiento → `RESERVED`, orden → `CONFIRMED`, se genera un `ticket` con código único, y se emite `BookingConfirmed` + `SeatSold` por WebSocket a todos los clientes del vuelo. | Aceptación |
| 3.6 | Pago rechazado (tarjeta de prueba inválida): asiento vuelve a `FREE`, orden → `CANCELLED`, se emite `SeatReleased`. | Aceptación |
| 3.7 | Nunca se persiste el número completo de la tarjeta; solo marca y últimos 4 dígitos. | Unitaria (entidad `Payment`) |
| 3.8 | Tras `CONFIRMED`, el asiento no puede volver a bloquearse ni venderse (intentar `POST /seats/:id/hold` sobre un `RESERVED` responde `409`). | Integración |
| 3.9 | El correo con el ticket se envía (o se registra el intento) de forma asíncrona tras la confirmación; un fallo en el envío de correo no revierte la reserva ya confirmada y el envío se reintenta. | Integración (adapter de notificación con doble en memoria) |
| 3.10 | Se envía **un correo por ticket** al correo de contacto de la orden, con la plantilla `ticket-confirmation` (HTML + texto plano): código de reserva, código de ticket, vuelo, fecha y hora (hora de Colombia), clase, asiento, total (COP si el comprador navegó en español, USD si en inglés) y la imagen QR. | Integración + Unitaria (plantilla y parámetros) |
| 3.11 | `GET /tickets/:code/qr.png` devuelve un PNG para un ticket real y `404` para cualquier otro código; es lo que enlaza el correo. | Integración |
| 3.12 | La plantilla escapa el HTML de los datos del pasajero y falla (no envía) si falta una variable. | Unitaria |

## HU4 — Dashboard / vista de estado del vuelo

**Como** administrador o usuario espectador, **quiero** ver métricas en tiempo real de la ocupación del
vuelo, **para** monitorear la demanda en vivo.

| # | Criterio | Tipo de prueba |
|---|---|---|
| 4.1 | `GET /dashboard/flights/:id` requiere autenticación y el permiso `dashboard:read` (`ADMIN` o `ADMIN_VIEWER`); sin el permiso responde `403`, sin token `401`. | Aceptación |
| 4.2 | La respuesta incluye conteo de asientos `FREE`, `BLOCKED`, `PAYMENT_PENDING` y `RESERVED`, y coincide exactamente con el estado real de `flights_seat_availability` en ese instante. | Integración |
| 4.3 | Conectado al tema `dashboard:{id}`, el cliente recibe un evento cada vez que cambia el estado de cualquier asiento de ese vuelo (`SeatHeld`, `SeatReleased`, `SeatSold`), sin necesidad de refrescar. | Aceptación (WS) |
| 4.4 | Solo el rol con permiso `flights:manage` (`ADMIN`) puede cambiar el `status` de un vuelo desde el dashboard; `ADMIN_VIEWER` puede ver pero el intento de cambiar responde `403`. | Aceptación |
| 4.5 | Un cambio manual de `status` del vuelo se refleja en la búsqueda pública (HU1.4) y en el dashboard de cualquier otro admin conectado, en la misma operación. | Aceptación |
| 4.6 | Cuando el admin cambia un vuelo a `CANCELLED` o `DELAYED`, se envía un correo de notificación (plantilla `flight-status-change`) a **cada orden `CONFIRMED`** de ese vuelo, a su correo de contacto, con los pasajeros listados. No se notifica a órdenes sin pagar ni a las de otros vuelos, y volver a `ACTIVE` o un cambio inválido no envía nada. Un correo por orden, aunque tenga varios pasajeros. | Integración (adapter de notificación con doble en memoria) |
| 4.7 | Los avisos se encolan en la misma transacción que el cambio de estado; si el proveedor de correo falla, el cambio de estado se mantiene y el aviso se reintenta sin duplicarse. | Integración |

---

## Notas de alcance para testing

- Las pruebas de integración y de aceptación viven en `backend/tests/integration/lifex/` y arrancan
  Postgres real con Testcontainers (requiere Docker). Usan un reloj controlado (`TestClock`) para la
  expiración de bloqueos y los reintentos del outbox, sin esperar tiempos reales.

- Las pruebas de concurrencia (2.2) y de expiración (2.5) son las que más valor demuestran en la
  sustentación: son la evidencia de que no hay doble reserva y de que el tiempo real es confiable, no solo
  "se ve bien en la demo".
- Los criterios marcados como "Aceptación (WS)" requieren el helper de pruebas que abre dos o más conexiones
  WebSocket simuladas contra la app de pruebas (sin servidor HTTP real), siguiendo el mismo patrón que ya usa
  `tests/acceptance/` con Supertest para REST.
- Ningún criterio de esta lista es opcional: si el tiempo no alcanza para alguno, se documenta explícitamente
  en `README.md` como pendiente, en vez de omitirlo en silencio.
