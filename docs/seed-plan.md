# Plan de seed

Implementado en `backend/prisma/seed.ts`:

```bash
cd backend
npm run db:seed            # catálogo + roles + usuarios + vuelos (no duplica si ya hay vuelos)
npm run db:seed -- --reset # borra vuelos, asientos, reservas y pagos y los vuelve a crear
```

Resultado actual: **370 vuelos** (222 nacionales + 148 internacionales) y **74.740 asientos**, en ~8 s.
Usuarios de prueba: `admin@lifex.test` (rol `ADMIN`) y `viewer@lifex.test` (rol `ADMIN_VIEWER`), contraseña
`Lifex-Demo-2026!`.

Describe los datos y el algoritmo; la implementación va en `backend/prisma/seed.ts` (o equivalente), no en
este documento.

## 1. Roles y permisos
- Crear roles `ADMIN` (todos los permisos de todos los módulos de negocio: `flights:manage`, `flights:read`,
  `dashboard:read`, etc.) y `ADMIN_VIEWER` (solo los permisos `*:read`).
- `SUPER_ADMIN` ya existe por la migración del scaffold base; no se toca.
- Crear un usuario de prueba por rol (`admin@lifex.test` / `viewer@lifex.test`) con contraseña conocida para
  la sustentación.

## 2. Países y ciudades (con nombre en inglés y en español)

**Nacional — Colombia** (10 ciudades, todas con aeropuerto propio):

| Ciudad | Código IATA | Nota |
|---|---|---|
| Medellín | MDE / RNG | Rionegro (José María Córdova) |
| Bogotá | BOG | |
| Cartagena | CTG | |
| Santa Marta | SMR | |
| Barranquilla | BAQ | |
| San Andrés | ADZ | |
| Cali | CLO | |
| Bucaramanga | BGA | |
| Pereira | PEI | |
| Armenia | AXM | |

**Internacional** (1–2 ciudades por país, capital + una secundaria donde se pidió):

| País | Capital | Ciudad secundaria |
|---|---|---|
| Estados Unidos | Washington D.C. | Miami |
| Panamá | Ciudad de Panamá | — |
| Reino Unido | Londres | Manchester |
| España | Madrid | Barcelona |
| Francia | París | Niza |
| Alemania | Berlín | Múnich |
| Portugal | Lisboa | Oporto |
| Bélgica | Bruselas | — |
| Italia | Roma | Milán |
| Suiza | Zúrich | Ginebra |
| Países Bajos | Ámsterdam | — |

> En la implementación son **11 países y 19 ciudades internacionales** (Panamá, Bélgica y Países Bajos con una
> sola ciudad); la rotación de destinos recorre esas 19.

Cada ciudad lleva su aeropuerto principal con código IATA real (ej. Madrid → MAD, Londres → LHR, Miami →
MIA). Los países sin "ciudad secundaria" en la nota original del cliente se seedean con una sola ciudad.

### Imágenes de ciudades (ciudad → nombre de archivo)

La base de datos guarda solo el **nombre del archivo** (`cities.imageName`); las fotos viven en
`frontend/public/img/destinations/` y la web arma la ruta `/img/destinations/<nombre>`. Si el archivo no existe,
la web muestra la imagen genérica del cielo. El seed asigna el nombre a **todas** las ciudades (con `upsert`,
así que `db:migrate` + `db:seed` sin `--reset` también lo dejan puesto en bases ya existentes). Regla del nombre:
nombre en inglés, minúsculas, sin tildes, sin puntos y con guiones (`Santa Marta` → `santa-marta.jpg`); las excepciones
son `sanandres.jpg`, `lisboa.jpg` y `panama.jpg` (nombres de las fotos ya agregadas). Al pasar las fotos a WebP hay que cambiar la extensión (`.jpg` → `.webp`) en el seed.

| Ciudad (inglés) | Ciudad (español) | País | Archivo | ¿Foto ya en el repo? |
|---|---|---|---|---|
| Medellín | Medellín | CO | `medellin.jpg` | sí |
| Bogotá | Bogotá | CO | `bogota.jpg` | sí |
| Cartagena | Cartagena | CO | `cartagena.jpg` | sí |
| Santa Marta | Santa Marta | CO | `santa-marta.jpg` | falta |
| Barranquilla | Barranquilla | CO | `barranquilla.jpg` | falta |
| San Andrés | San Andrés | CO | `sanandres.jpg` | sí |
| Cali | Cali | CO | `cali.jpg` | sí |
| Bucaramanga | Bucaramanga | CO | `bucaramanga.jpg` | falta |
| Pereira | Pereira | CO | `pereira.jpg` | falta |
| Armenia | Armenia | CO | `armenia.jpg` | falta |
| Washington D.C. | Washington D.C. | US | `washington-dc.jpg` | falta |
| Miami | Miami | US | `miami.jpg` | sí |
| Panama City | Ciudad de Panamá | PA | `panama.jpg` | sí |
| London | Londres | GB | `london.jpg` | sí |
| Manchester | Mánchester | GB | `manchester.jpg` | falta |
| Madrid | Madrid | ES | `madrid.jpg` | sí |
| Barcelona | Barcelona | ES | `barcelona.jpg` | falta |
| Paris | París | FR | `paris.jpg` | falta |
| Nice | Niza | FR | `nice.jpg` | falta |
| Berlin | Berlín | DE | `berlin.jpg` | falta |
| Munich | Múnich | DE | `munich.jpg` | falta |
| Lisbon | Lisboa | PT | `lisboa.jpg` | sí |
| Porto | Oporto | PT | `porto.jpg` | falta |
| Brussels | Bruselas | BE | `brussels.jpg` | falta |
| Rome | Roma | IT | `rome.jpg` | falta |
| Milan | Milán | IT | `milan.jpg` | sí |
| Zurich | Zúrich | CH | `zurich.jpg` | falta |
| Geneva | Ginebra | CH | `geneva.jpg` | falta |
| Amsterdam | Ámsterdam | NL | `amsterdam.jpg` | sí |

Faltan **22** fotos (las 7 existentes: Bogotá, Cartagena, Londres, Madrid, Medellín, Miami y San Andrés).

## 3. Equipaje (catálogo único, sin cruzar con `flight_class`)

| luggage_type | rank | fee_percentage |
|---|---|---|
| Light | 1 | 10% |
| Classic | 2 | 15% |
| Flex | 3 | 18% |
| Business Classic | 4 | 20% |
| Business Flex | 5 | 25% |

En la tabla `luggage_type` la restricción se guarda como `businessOnly = true` para Business Classic y Business Flex.

`Business Classic` y `Business Flex` solo pueden elegirse cuando el asiento del ticket es `seat_class =
BUSINESS`; esa restricción se valida en la entidad `TicketLuggage`, no en el seed.

## 4. Aeronaves

Cada aeronave tiene `reference` (el modelo), una `description` en inglés y una `description_es` en español
(frase corta con alcance y capacidad). `range_miles` guarda **millas náuticas**. Se crean 9 aeronaves:

| Modelo | Tipo | Alcance | Asientos | Business + Economy | Columnas Economy | Unidades |
|---|---|---|---|---|---|---|
| Boeing 787-8 Dreamliner | `INTERNATIONAL` (largo alcance) | 7.850 nmi (14.500 km) | 242 | 24 + 218 | `ABCDEFGH` | INT-001, INT-002 |
| Boeing 787-9 | `INTERNATIONAL` (largo alcance) | 7.828 nmi (14.498 km) | 290 | 28 + 262 | `ABCDEFGH` | INT-003, INT-004 |
| Boeing 737 MAX 8 | `INTERNATIONAL` (regional) | 3.547 nmi (6.570 km) | 162 | 12 + 150 | `ABCDEF` | INT-005, INT-006 |
| Airbus A320neo | `DOMESTIC` (solo nacional) | 3.400 nmi | 150 | 24 + 126 | `ABCDEF` | DOM-001..003 |

`BUSINESS` siempre en columnas `A C D F` (filas de 4). Decisión del seed: la cantidad de asientos Business de
cada modelo (24, 28, 12 y 24) se eligió para que cuadre con filas completas de 4; los 787 no cierran en filas
completas de Economy, así que su última fila queda parcial (2 y 6 asientos) para respetar la capacidad exacta.

Los vuelos nacionales usan solo A320neo. Para los internacionales se comprueba que la aeronave tenga alcance
suficiente (`duración × 450 nudos`): las rutas cortas a Estados Unidos y Panamá usan el 737 MAX 8 (regional) y
las de Europa los 787 (rotan entre 787-8 y 787-9). Los `seat_row`/`seat_column` se generan en el seed de
`flights_seat_availability` por cada vuelo programado (no se precargan asientos sin vuelo asociado).

## 5. Vuelos programados

Rango de fechas: **2026-11-19 → 2027-01-31** (inclusive), 74 días.

### Nacionales — 3 vuelos diarios
- Rotan combinando las 10 ciudades colombianas entre sí (todas las combinaciones ordenadas
  origen≠destino son válidas: 10 × 9 = 90 pares posibles).
- Algoritmo: generar la lista completa de 90 pares, y cada día tomar 3 pares consecutivos de esa lista en un
  índice circular que avanza 3 posiciones por día (`dayIndex * 3 % 90`), así en ~30 días se recorre toda la
  matriz de rutas antes de repetir.
- Horarios sugeridos por vuelo/día: mañana (07:00–09:00 según duración estimada), tarde (13:00–15:00), noche
  (19:00–21:00) — fijos por posición dentro del día, para que la demo pueda mostrar los 3 horarios distintos.
- Aeronave `DOMESTIC` en cada uno.

### Internacionales — 2 vuelos diarios (uno de tarde, uno de noche)
- Origen: solo Medellín (MDE) o Bogotá (BOG), alternando por día (días pares desde MDE, días impares desde
  BOG, o el criterio que resulte más simple de generar).
- Destino: capital o ciudad secundaria de uno de los 10 países, rotando por la lista completa de 20 ciudades
  (10 países × hasta 2 ciudades) en índice circular, 2 por día.
- Horario de tarde: ~14:00–16:00 salida; horario de noche: ~22:00–00:00 salida (según duración estimada por
  distancia real aproximada).
- Aeronave `INTERNATIONAL`.

### Campos derivados al generar cada `scheduled_flight`
- `arrival_date` = `departure_date` + duración estimada (puede ser un valor fijo razonable por tipo de ruta
  para esta prueba, no cálculo real de grandes círculos).
- `num_max_seats` = capacidad de la aeronave asignada.
- `num_available_seats` = `num_max_seats` al momento de crear el vuelo (decrece con cada `RESERVED`).
- `base_price_default`: único precio de partida, en USD (nacional ~80–150; internacional ~400–850, variando por
  ruta). Business se deriva con `BUSINESS_BASE_MULTIPLIER` (×3). `average_price_economy`,
  `average_price_business` y `occupancy_rate` empiezan en **0** y `num_available_seats` = `num_max_seats`:
  las reglas de HU5 (precio dinámico y ofertas) aplican apenas se empieza a vender. El `seat_price` inicial de
  cada asiento es el precio base de su clase; al bloquearse guarda el precio vigente.
- `status` = `ACTIVE` por defecto; el seed no crea vuelos ya `CANCELLED`/`DELAYED` (esos estados se generan
  manualmente desde el dashboard durante la demo, para demostrar HU1.4 y HU4.5 en vivo).
- `flights_seat_availability`: una fila por asiento según el layout de la aeronave (`seat_row`/
  `seat_column`/`seat_class`), todas en `FREE`.

## 6. Orden de ejecución del seed
1. `countries` → `cities` → `airports`.
2. `aircraft`.
3. `luggage_type`.
4. `roles` + `role_permissions` + usuarios de prueba (`ADMIN`, `ADMIN_VIEWER`). `ADMIN`: `flights:read`, `flights:manage`, `dashboard:read`; `ADMIN_VIEWER`: `flights:read`, `dashboard:read`.
5. `flight_routes` (se derivan de las combinaciones de aeropuertos que usan los vuelos del paso 6).
6. `scheduled_flights` + `flights_seat_availability` (el paso más pesado; generar en lotes con
   `createMany` de Prisma, no fila por fila, para que el seed corra en segundos y no en minutos).
