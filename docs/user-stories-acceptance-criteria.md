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
| 4.6 | Cuando el admin cambia un vuelo a `CANCELLED` o `DELAYED`, se envía un correo de notificación (plantilla `flight-status-change`) a **cada orden `CONFIRMED`** de ese vuelo, a su correo de contacto, con los pasajeros listados. El **asunto** es «Tu boleto Lifex — CÓDIGO fue CANCELADO» o «Tu boleto Lifex — CÓDIGO fue RETRASADO», y el texto es corto y diplomático: lamenta el inconveniente y pide **estar pendiente del correo**, por donde se informarán las novedades del vuelo. **Cada cambio** a `DELAYED` o `CANCELLED` envía su propio aviso (un vuelo retrasado y luego cancelado genera dos correos por reserva); volver a `ACTIVE` no envía nada. La respuesta de `PATCH /flights/:id/status` trae `notifiedOrders` (a cuántas reservas se avisó) y la tabla del panel muestra las reservas pagadas de cada vuelo. No se notifica a órdenes sin pagar ni a las de otros vuelos, y volver a `ACTIVE` o un cambio inválido no envía nada. Un correo por orden, aunque tenga varios pasajeros. | Integración (adapter de notificación con doble en memoria) |
| 4.7 | Los avisos se encolan en la misma transacción que el cambio de estado; si el proveedor de correo falla, el cambio de estado se mantiene y el aviso se reintenta sin duplicarse. | Integración |

### Panel de administración: resumen del día y lista de vuelos

| # | Criterio | Tipo de prueba |
|---|---|---|
| 4.8 | `GET /dashboard/overview?date=AAAA-MM-DD` (por defecto, hoy en hora de Colombia; permiso `dashboard:read`) devuelve los indicadores y series de los vuelos que salen ese día: vuelos (total, nacionales, internacionales y por estado), ocupación (total, por tipo de ruta y por clase), salidas por hora, tickets vendidos, ingresos (reservas `CONFIRMED`) y vuelos con novedades (cancelados o retrasados). | Unitaria + integración |
| 4.9 | `GET /dashboard/flights` devuelve **todos** los vuelos (nacionales e internacionales) paginados (`page`, `pageSize` ≤ 100) con `total`, ordenados por salida, y se filtra por `from` (origen IATA), `to` (destino IATA) y `date`. Sin fecha lista los que aún no salieron. Un filtro inválido responde `400` (`INVALID_AIRPORT`, `INVALID_PAGE`, `INVALID_SEARCH_DATE`). | Integración |
| 4.10 | El dashboard muestra tarjetas de indicadores y tres gráficas (vuelos por hora, ocupación y vuelos por estado), y debajo la tabla de vuelos del día con paginación y filtros de origen y destino con **autocompletar** por código IATA o ciudad (los mismos aeropuertos, nacionales e internacionales, que el buscador de la web). | Componente |
| 4.11 | La sección **Vuelos** lista todos los vuelos con filtros de origen, destino y fecha y paginación; la ven `ADMIN` y `ADMIN_VIEWER` (`dashboard:read`), y solo `ADMIN` (`flights:manage`) ve el botón de cambiar estado. | Componente |

## HU5 — Precios dinámicos y ofertas

**Como** viajero, **quiero** ver el precio vigente de cada clase y las ofertas del momento, **para** decidir
qué comprar con el precio que realmente voy a pagar. **Como** aerolínea, **quiero** que el precio suba con la
demanda y con la cercanía del vuelo, y que las ofertas ayuden a llenar los vuelos con baja ocupación.

### Cómo funcionan los precios

Todos los valores están en USD; el front convierte a COP con `IATA_TRM`. Cada vuelo guarda cuatro cifras que
alimentan el cálculo: `basePriceDefault` (precio mínimo de partida del vuelo), `averagePriceEconomy`,
`averagePriceBusiness` (promedio de lo pagado por asiento en cada clase) y `occupancyRate`, además de
`numAvailableSeats`.

**Precio base de cada clase.** Economy parte de `basePriceDefault`; Business parte de
`basePriceDefault × BUSINESS_BASE_MULTIPLIER` (por defecto ×3), porque `basePriceDefault` es un solo valor por
vuelo.

**Primer ticket (promedio en 0).** Si todavía no se ha comprado ningún asiento de esa clase, el precio es el
precio base de la clase **+20 %**.

**Con compras previas (promedio > 0).** El precio es el promedio de esa clase **+5 %**. Al comprar, el
promedio cambia, así que el precio del siguiente comprador sube un poco más.

**Subida por cercanía al vuelo.** En las **últimas 72 horas** antes de la salida, cada hora completa que pasa
suma **0,5 %** de la referencia (el promedio de la clase; o, si todavía no hay ventas, el precio del primer
ticket). La subida se detiene (queda congelada) a **2 horas** de la salida en vuelos nacionales y a **5 horas**
en internacionales: a partir de ahí el precio ya no sube más y las ventas siguen abiertas. Máximo: 70 horas
de recargo en nacionales (+35 %) y 67 en internacionales (+33,5 %).

Ejemplo (nacional, promedio Economy 200 USD): el precio base es 210 USD (promedio +5 %). A 48 h de la salida han
pasado 24 h dentro de la ventana: 210 + 24 × 1,00 = 234 USD. A 2 h o menos: 210 + 70 × 1,00 = 280 USD.

**Cuándo se calcula y cuándo se congela.** El precio se calcula al momento de mostrarlo: en `GET /flights`,
`GET /flights/:id` (`priceEconomyUsd`, `priceBusinessUsd`) y en el mapa de asientos (los asientos libres
muestran el precio vigente de su clase). **Al bloquear un asiento, el precio vigente se congela** en el
asiento y es el que se cobra: el viajero paga lo que vio al elegir, aunque el precio cambie mientras completa
sus datos.

**Cuándo se actualizan las cifras.** Después de cada **compra exitosa** (en la misma transacción que confirma
la reserva) se recalculan `numAvailableSeats`, `occupancyRate` y los promedios de cada clase. Un pago
rechazado no cambia nada.
- `numAvailableSeats` = asientos máximos − asientos `RESERVED`.
- `occupancyRate` = asientos `RESERVED` / asientos máximos × 100 (2 decimales).
- `averagePriceEconomy` / `averagePriceBusiness` = promedio del precio congelado de los asientos `RESERVED` de
  la clase (0 si no hay ninguno). El equipaje, los extras y los impuestos no entran en el promedio.

**Equipaje y extras son costos adicionales.** El precio de la tarifa (el del asiento) no incluye equipaje: el
equipaje y demás servicios se cobran aparte, como un porcentaje (`feePercentage` del tipo de equipaje) sobre el
precio del asiento, cuando el usuario elige o mejora su opción después de escoger el asiento. Los impuestos
(`TAX_PERCENTAGE`) se suman al final sobre el vuelo más el equipaje.

### Ofertas y descuentos

Las **ofertas son el descuento** y son **excluyentes con el precio dinámico**: un vuelo en oferta no lleva
el +20 %, el +5 % ni el recargo por horas. Su precio de clase es el precio base de la clase menos
`OFFER_DISCOUNT_PERCENTAGE` (por defecto 15 %), y el vuelo se marca con `offer: { discountPercentage }`.
No existen otros descuentos: si se agregan en el futuro, tampoco se acumularán con el precio dinámico ni
entre sí.

Un vuelo es oferta si está `ACTIVE`, sale **entre 8 y 30 días** desde hoy y cumple **cualquiera** de:
1. `occupancyRate` ≤ 60 %.
2. `numAvailableSeats` ≥ 100.
3. Los promedios de ambas clases no superan en más de 30 % su precio base (Economy ≤ `basePriceDefault × 1,3`
   y Business ≤ `basePriceDefault × BUSINESS_BASE_MULTIPLIER × 1,3`; un promedio en 0 cumple).

`GET /flights/offers` (público) elige al azar entre los vuelos elegibles, **sin repetir ruta**, hasta **5
nacionales y 5 internacionales**, ya con el descuento aplicado.

| # | Criterio | Tipo de prueba |
|---|---|---|
| 5.1 | Primer ticket de una clase: precio base de la clase +20 % (Business usa el multiplicador ×3). | Unitaria (dominio) |
| 5.2 | Con promedio > 0 el precio es el promedio +5 %. | Unitaria (dominio) |
| 5.3 | El recargo es 0,5 % de la referencia por hora completa dentro de las últimas 72 h, y se congela a 2 h (nacional) y a 5 h (internacional); se prueban 72, 48, 10, 5, 2 y 1 h. | Unitaria (dominio, reloj inyectado) |
| 5.4 | `GET /flights` y `GET /flights/:id` devuelven `priceEconomyUsd`, `priceBusinessUsd` y `offer` calculados al consultar. | Integración (BD real) |
| 5.5 | El mapa de asientos muestra el precio vigente en los asientos libres; al bloquear, el precio se congela y un cambio posterior del promedio no lo toca; la reserva cobra el precio congelado. | Integración (BD real) |
| 5.6 | Tras un pago aprobado se recalculan `numAvailableSeats`, `occupancyRate` y los promedios; el segundo comprador ve el precio subido; un pago rechazado no cambia nada. | Integración (BD real) |
| 5.7 | Una oferta ignora el precio dinámico; los bordes de 8 y 30 días y los umbrales de 60 %, 100 asientos y 30 % se cumplen exactamente. | Unitaria (dominio) |
| 5.8 | `GET /flights/offers` respeta la ventana de 8 a 30 días, devuelve como máximo 5 nacionales y 5 internacionales, no repite ruta y excluye vuelos que no cumplen ningún criterio o no están `ACTIVE`. | Integración (BD real) |
| 5.9 | El precio de una oferta coincide en `GET /flights`, en `GET /flights/offers` y en el precio que se congela al bloquear un asiento. | Integración (BD real) |

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
