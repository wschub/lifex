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

Se crean 5 aeronaves (3 `DOMESTIC` DOM-001..003 y 2 `INTERNATIONAL` INT-001..002) y los vuelos rotan entre las del mismo tipo. Layout: asientos `BUSINESS` en columnas `A C D F` (filas 1..6 en la nacional, 1..10 en la internacional) y `ECONOMY` en `ABCDEF` (nacional) o `ABCDEFGH` (internacional). Modelos: uno `DOMESTIC` (menor capacidad, ej. 150 asientos: 24 `BUSINESS` + 126 `ECONOMY`) y uno
`INTERNATIONAL` (mayor capacidad, ej. 280 asientos: 40 `BUSINESS` + 240 `ECONOMY`), con su `seat_row`/
`seat_column` generados en el seed de `flights_seat_availability` por cada vuelo programado (no se
precargan asientos sin vuelo asociado).

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
- `base_price_default`, `average_price_economy`, `average_price_business`: valores de ejemplo razonables en
  USD (p. ej. nacional economy ~80–150 USD, nacional business ~200–300 USD; internacional economy ~400–900
  USD, business ~1200–2500 USD, variando un poco por ruta para que la demo no se vea idéntica en todos los
  vuelos).
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
