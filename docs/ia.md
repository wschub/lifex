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
- *(Completar al terminar el frontend: prompts de generación de componentes de React.)*

## Refactorización y criterio propio
*(Completar durante la implementación: casos concretos en los que el código sugerido por la IA estuvo
incompleto o era subóptimo, y cómo se corrigió. Ejemplos de lo ya detectado en el diseño, antes de escribir
código:)*
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

## Impacto estimado
*(Completar al terminar la implementación: tiempo ahorrado aproximado y en qué áreas aportó más valor — ej.
diseño del modelo de datos y de la estrategia de idempotencia, boilerplate de módulos siguiendo la
convención de `ADDING-A-MODULE.md`, redacción de documentación.)*
