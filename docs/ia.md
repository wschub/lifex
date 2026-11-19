# Uso de Inteligencia Artificial

## Herramientas utilizadas
- **Claude** (Opus 5.5 y Sonnet 5, vía claude.ai) — usado para el diseño de arquitectura, la revisión y
  corrección del modelo de base de datos, la definición del patrón de concurrencia/idempotencia, y la
  redacción de los criterios de aceptación no negociables por historia de usuario.
- **Claude Code** (CLI, extensión de VS Code; modelo Sonnet 5.5) — usado para implementar el backend
  módulo por módulo siguiendo `ADDING-A-MODULE.md`, escribir el seed, las pruebas de integración con
  Testcontainers y actualizar la documentación.

## Prompts y casos de uso clave
- Revisión del modelo de datos propuesto, detectando los estados faltantes para evitar doble reserva
  (`PAYMENT_PENDING`), la tabla faltante que conecta tickets con equipaje, y la normalización de
  países/ciudades/aeropuertos para soportar inglés/español.
- Definición del patrón de idempotencia de pagos (Outbox + reintentos) ajustado al stack existente (sin
  Redis ni colas externas), en vez de proponer infraestructura nueva por defecto.
- Justificación de la arquitectura hexagonal con ejemplos concretos del propio código del scaffold (reglas
  R1–R9 del test de arquitectura), no en abstracto.
- Redacción de los criterios de aceptación de las 4 historias de usuario del enunciado, en formato
  verificable (uno por comportamiento, no uno por historia).
- Implementación del backend a partir de `docs/tasks.md`: "lee los README, crea la estructura de carpetas
  y avísame cuando vayas a empezar con el backend", luego "continúa con los siguientes pasos" módulo por
  módulo, verificando cada paso con `npm run verify`.
- Plantillas de correo (confirmación de boleto en HTML y texto plano) diseñadas aparte y luego conectadas
  al adapter de Brevo con un renderer propio, parámetros formateados (hora de Colombia, COP/USD) y la imagen
  QR servida por la propia API.
- Caso de uso añadido a mitad del proyecto: aviso por correo a los pasajeros cuando el admin cancela o
  retrasa un vuelo (HU4.6/4.7), reutilizando el patrón Outbox en vez de enviar el correo dentro de la
  petición del admin.
- Diseño del servicio de precios dinámicos (HU5): "diseña un servicio de dominio puro que calcule el precio
  de cada clase: primer ticket +20 %, luego promedio +5 % y +0,5 % por hora en las últimas 72 h, con corte a 2 h
  nacional / 5 h internacional", con el reloj inyectado para probar los bordes (72, 48, 10, 5, 2 y 1 h).
- Reglas de ofertas: "vuelos a 8–30 días que cumplan algún criterio (ocupación ≤ 60 %, ≥ 100 asientos libres,
  promedios dentro de 30 % de la base), 5 nacionales + 5 internacionales sin repetir ruta, con descuento
  excluyente del precio dinámico", y que el precio se congele al bloquear el asiento.
- Reestructuración del repositorio y del despliegue: de ramas separadas por subproyecto a un solo repositorio
  con un servicio de frontend (`server.mjs`) que sirve la web en `/`, el dashboard en `/dashboard` y hace de proxy
  de `/api` y del WebSocket hacia el backend privado; diagnóstico previo, Dockerfiles, `railway.json` y CI.
- Frontend: web pública y dashboard (React, Vite, shadcn) a partir del diseño y las plantillas del cliente;
  autocompletado de aeropuertos, modal de sesión (inactividad y plazo de compra), KPIs y gráficos, detalle de
  vuelo con pasajeros y check-in, y secciones solo para administradores.

## Refactorización y criterio propio
Casos concretos en los que el código sugerido estuvo incompleto o era subóptimo, y cómo se corrigió:
- La primera versión del modelo de asientos (`FREE/BLOCKED/RESERVED`) tenía una condición de carrera real
  entre el job de expiración y un pago en curso; se corrigió agregando el estado `PAYMENT_PENDING` antes de
  implementar nada.
- Durante las pruebas del tiempo real se encontró que el reloj de pruebas no avanzaba con el real y el
  outbox (que compara contra `now()` de la base) dejaba eventos "no vencidos": se rehízo el reloj de
  pruebas como un desplazamiento sobre el reloj real.
- Se detectó que el volumen de Docker `backend_pgdata` pertenecía a otro proyecto con Postgres 16 y hacía
  caer el contenedor de Postgres 17; se fijó `name: lifex` en `docker-compose.yml` en vez de borrar el volumen.
- Se detectó que `Idempotency-Key` con un hash directo del número de tarjeta es adivinable (el espacio de
  números es pequeño): se usa una huella HMAC con secreto del servidor, y la tarjeta se convierte en token
  antes de tocar la base o el outbox.
- Se descartó la sugerencia inicial de usar NestJS en favor de extender el scaffold Express/hexagonal ya
  existente, por tener auth, roles y el test de arquitectura ya construidos y probados.
- Los asientos disponibles de un vuelo se calculaban contando los `FREE`; un bloqueo temporal (15 min) hacía
  bajar el número y distorsionaba la ocupación y los umbrales de oferta. Se cambió a `máximo − RESERVED`,
  recalculado en la misma transacción que confirma el pago.
- La primera forma de servir el frontend (`serve` con reescrituras encadenadas) no resolvía bien `/` y
  `/dashboard`, y la cookie de refresh (`Path=/auth`) no viajaba por el prefijo `/api`; se escribió un
  servidor propio que reescribe la ruta de la cookie.
- La lista de vuelos del dashboard se truncaba a 100 filas y ocultaba los internacionales; se pasó a
  paginación y filtros en el servidor.
- Tras un despliegue, una pestaña abierta pedía un archivo con hash que ya no existía («Unexpected Application
  Error»); se añadió recarga única automática y un aviso con botón si el fallo persiste.

## Impacto estimado
Cifras **aproximadas y subjetivas** (estimación del equipo, no medidas con cronómetro):

- **Servicio de precios dinámicos y ofertas (HU5):** ~1 día de diseño, reglas límite y pruebas sin IA frente a
  ~2–3 h con ella (ahorro estimado: 5–6 h).
- **Reestructuración a un solo servicio y despliegue en Railway** (Dockerfiles, proxy, cookies, CI, variables y
  documentación): ~2 días frente a ~4–5 h con ayuda de la IA (ahorro estimado: 10–12 h).
- **Diseño del modelo de datos y de la idempotencia, boilerplate de módulos y documentación:** el mayor valor
  fue evitar errores de diseño (estado `PAYMENT_PENDING`, huella HMAC) antes de escribir código.
- Lo que no se delegó: decisiones de producto, revisión de cada commit y la verificación en producción.
