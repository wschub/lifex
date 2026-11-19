# Diseño del frontend de Lifex

Fecha: 2026-11-19. Estado: pendiente de aprobación.

## 1. Intención

Convertir el prototipo estático `FRONTEND-WEB/web` (11 HTML con datos de ejemplo) en el frontend real de Lifex,
conectado a la API y al WebSocket que ya existen (`backend/`, contratos en `shared/`). Además, construir el panel
administrativo con login real. Quien compra es un viajero, sobre todo de Colombia, que quiere comprar rápido y sin
sorpresas de precio. Quien administra es personal de Lifex (staff) que gestiona vuelos y mira el dashboard.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- La web pública se ve **idéntica** al prototipo (`DESIGN.md` y `PRODUCT.md` son la referencia). Solo cambia el origen
  de los datos: la API.
- Asientos en vivo (un asiento tomado por otro se ve ocupado al instante), reserva de invitado, pago asíncrono (202) y
  boleto con QR, todo contra el backend real.
- Panel admin con shadcn: login en dos pasos, dashboard con métricas, lista de vuelos y cambio de estado.
- Correos con el logo definitivo vía `APP_URL`.

**No objetivos**
- No rediseñar ni "mejorar" la web pública. No migrarla a Tailwind ni a shadcn.
- No reemplazar las fotos de la cabina (las cambia el equipo de diseño después).
- No pagos reales ni inventario real: el pasarela es la simulada del backend.

**Anti-objetivos (fallaría aunque funcione)**
- Que cualquier pantalla pública cambie de aspecto, tipografía, colores o espaciado.
- Que el CSS de Tailwind del admin se filtre a la web pública.
- Un precio que cambie entre pantallas o que no sea el que calcula el backend.

## 3. Restricciones

- El backend y `shared/` están cerrados; los cambios en el backend se limitan a lo listado en la sección 7.
- Monolito modular hexagonal en el backend; en el frontend, carpetas ya creadas en `frontend/src/`
  (`app/public`, `app/admin`, `components/ui`, `api`, `ws`, `i18n`, `stores`, `hooks`, `lib`).
- Los tipos y validaciones salen de `@lifex/shared` (alias a `../shared/src/index.ts`).
- Las URLs públicas van en inglés.
- Fuentes Jost y Hanken Grotesk autoalojadas (ya están en el prototipo).

## 4. Enfoques considerados

| Enfoque | Qué es | Compromisos |
|---|---|---|
| **A (elegido)** | Portar a React copiando marcado y `lifex.css` sin cambios | Idéntico visualmente; stack único con el admin; hay que reescribir el JS de render a JSX |
| B | Dejar HTML/JS vanilla e inyectar datos con `fetch` | Cero riesgo de diseño, pero dos stacks y estado en vivo difícil de probar |
| C | Reescribir con Tailwind/shadcn | Contradice "la web no se toca" |

Para el admin y la web pública en el mismo proyecto: se carga el admin como un trozo aparte (lazy) y **todo salto
entre público y admin es una navegación completa** (`<a href>`), para que el CSS de Tailwind nunca conviva con
`lifex.css`. Decisión mía.

## 5. Web pública

**Rutas (inglés):**

| Prototipo | Ruta |
|---|---|
| `index.html` | `/` |
| `resultados.html` | `/results` |
| `tarifas.html` | `/fares` |
| `resumen.html` | `/summary` |
| `pasajeros.html` | `/passengers` |
| `personaliza.html` | `/customize` |
| `asientos-economy/business.html` | `/seats` (la cabina según la tarifa) |
| `pago.html` | `/payment` |
| `confirmacion.html` | `/confirmation` |
| `creditos.html` | `/credits` |

**Cómo se porta (decisión del usuario: no tocar el diseño):**
- `lifex.css`, fuentes e imágenes se copian tal cual a `frontend/src/app/public/` y `frontend/public/`.
- El diccionario es/en de `app.js` pasa a `frontend/src/i18n/` sin cambiar un texto. El idioma se recuerda en
  `localStorage` (`lx-lang`) como hoy. Español muestra COP; inglés, USD.
- El botón "Iniciar sesión / Log in" del encabezado lleva a `/admin/login`.

**Datos reales en lugar de los de ejemplo:**
- Búsqueda y resultados: `GET /flights`. Mapa de asientos: `GET /flights/:id/seats` + WebSocket `flight:{id}`.
- Los datos de ejemplo de `app.js` (`CITIES`, `DEST`, `FARES`, tasa fija 4000, `TAX_SHARE`) desaparecen. Las tarifas
  (Light/Classic/Flex y las de Business) salen de los tipos de equipaje del catálogo; los precios, de lo que calcula
  el backend; el COP, de `IATA_TRM`.

**Flujo y estado (lo único que se reordena por dentro, sin cambiar lo que ve el usuario):**
1. `/results` → `/fares` → `/summary`: solo lectura y estado local.
2. `/passengers`: se recogen pasajeros y contacto; al continuar se crea la reserva (`POST /bookings` con el email del
   contacto) y se guarda el token de invitado.
3. `/customize` → `/seats`: se bloquea el asiento (`POST …/hold`, con cuenta regresiva de `MAX_SEAT_LOCK_TIME`);
   los pasajeros ya escritos se guardan con `PUT /bookings/:id/passengers` junto con el asiento y el equipaje.
4. `/payment`: `POST` de pago con `Idempotency-Key`, respuesta 202; el resultado llega por WebSocket
   (`BookingConfirmed`) con consulta de respaldo.
5. `/confirmation`: boleto con QR (`/tickets/:code/qr.png`).

El estado del asistente (reemplaza a `sessionStorage` `lx`) vive en Zustand; el servidor es la fuente de verdad del
estado de la reserva (TanStack Query).

**Tiempo real:** cliente WS con reconexión; al reconectar pide el snapshot por REST y compara `version` de los
eventos para detectar huecos. Los eventos actualizan la caché con `queryClient.setQueryData`.

## 6. Panel administrativo (shadcn)

- **Rutas:** `/admin/login` y `/admin` (dashboard). El botón de login de la web lleva a `/admin/login`; con sesión
  válida y permiso `dashboard:read`, a `/admin`.
- **Login:** bloque `login-05` de shadcn (`npx shadcn@latest add login-05`). Primero se pide el correo y luego se
  muestra el campo de la clave. El primer paso solo valida el formato del correo y no consulta si existe (evita
  revelar qué correos son del staff); el `POST /auth/login` se envía en el segundo paso. Decisión mía.
- **Dashboard:** bloque `dashboard-01` (`npx shadcn@latest add dashboard-01`) adaptado a datos reales:
  `GET /dashboard/flights?date=` y `GET /dashboard/flights/:id`, métricas por estado y clase, tabla de vuelos con
  TanStack Table, cambio de estado (`flights:manage`) y actualización en vivo con `dashboard:{id}`.
- **Marca (confirmado):** donde la plantilla dice "Acme Inc." va el logo horizontal (el mismo del encabezado de la
  web) cuando el menú lateral está abierto, en escritorio o iPad; con el menú colapsado o en móvil, solo el icono.
  El login usa el mismo logo horizontal.
- **Guard:** las rutas de `/admin` comprueban `GET /auth/me` y sus permisos; sin ellos, redirigen a `/admin/login`.
  Los botones que requieren `flights:manage` se ocultan al rol `ADMIN_VIEWER`.
- **Aislamiento:** Tailwind v4 y shadcn solo en este trozo; la web pública no los usa.

## 7. Cambios necesarios en el backend y `shared/`

1. **Imagen por ciudad:** columna `cities.imageUrl` (texto, nulo) con migración; `Country/City` del catálogo y el DTO
   de `shared/` la incluyen; el seed la llena para las ciudades que tienen foto en el prototipo (Bogotá, Medellín,
   Cartagena, San Andrés, Miami, Madrid, Londres). Guarda una ruta relativa (`/img/destinations/bogota.jpg`) que el
   frontend resuelve contra su propio origen; las imágenes van en `frontend/public/img/destinations/`. Sin imagen,
   el frontend usa la imagen genérica del cielo.
2. **`APP_URL`:** variable nueva en `env.ts` y `.env.example` (por defecto `http://localhost:5173`). Las plantillas
   de correo reciben un parámetro `LOGO_URL` armado como `${APP_URL}/mail/<archivo>.png`.
3. **Logo en los correos:** los PNG de `logos_mail_png/` se copian a `frontend/public/mail/`; se reemplaza el bloque
   `<!-- LOGO -->` de las dos plantillas (HTML) por `lifex-concept2-vertical-slogan-color-1200w.png` con `width=200`
   y alto automático (decisión del usuario). Como esa versión tiene letras negras, la cabecera de las plantillas
   pasa de azul oscuro a blanco para que se lea. Hasta que `APP_URL` sea público (Railway), los correos reales no
   cargarán el logo.
4. **Tasa y precios para el COP:** si el backend aún no entrega `IATA_TRM` al navegador, se añade un endpoint público
   de solo lectura (`GET /config`) con `iataTrm` y `taxPercentage`. Se confirma en el plan.

## 8. Pruebas

- Frontend: Vitest + Testing Library para formato de dinero y fechas, i18n, estado del asistente, reductor de
  eventos WS y guard del admin.
- Contratos: todo lo que se recibe de la API se valida con los esquemas de `shared/`.
- Backend: pruebas del campo `imageUrl` y de `LOGO_URL` en las plantillas; `npm run verify` debe seguir en verde.
- Verificación visual: abrir la web portada junto al prototipo y comparar pantalla por pantalla.

## 8.1 Pendientes urgentes (se resuelven al terminar la v1 del frontend)

- **Tarifas:** el prototipo tiene cinco tarifas con multiplicadores de precio de ejemplo (Light, Classic, Flex,
  Business Classic, Business Flex) y precios de asiento por zona. Hay que alinearlas con lo que cobra realmente el
  backend (tipos de equipaje y precios de asiento) y decidir qué se muestra. En la v1 se muestran los valores del
  backend tal como vienen.
- **Orden de pasos y reserva:** el titular de la reserva se completa antes de elegir asiento (así lo hace el
  prototipo), por lo que crear la reserva al final de `/passengers` no cambia nada para el usuario ni para el
  backend. Si al implementarlo se descubre un choque con el backend, se anota aquí como urgente y se resuelve junto
  con las tarifas.

## 9. Lo que queda a criterio de quien lo construye

Estructura interna de componentes, nombres de hooks, detalle de las claves de caché y la pantalla de errores
(sin diseño en el prototipo: se usan los estilos existentes de aviso). Las fotos de cabina siguen siendo las
provisionales.
