# Despliegue en Railway

Tres servicios en un mismo proyecto de Railway: **Postgres**, **backend** (API privada) y **frontend**
(web en `/`, dashboard en `/dashboard` y proxy de `/api` y del WebSocket hacia el backend). Solo el frontend
tiene dominio público: el navegador siempre habla con un único origen.

```
Navegador ──https──▶ frontend (node server.mjs)
                       ├─ /            web pública (SPA)
                       ├─ /dashboard   login + panel (SPA)
                       ├─ /healthz     healthcheck propio
                       └─ /api/*  ───▶ backend (red privada, quita el prefijo: /api/x → /x)
                          /api/ws ──▶ backend /ws (upgrade de WebSocket)
                                         └──▶ Postgres (red privada)
```

## Cambios hechos para este despliegue (por archivo)

| Archivo | Cambio |
|---|---|
| `backend/Dockerfile` | `npm pkg delete scripts.prepare` antes de `npm ci` (husky no se instala con `--omit=dev`); la imagen final lleva `prisma/`, `prisma.config.ts` y OpenSSL para migrar |
| `backend/package.json` | `prisma` y `dotenv` pasan a `dependencies`; husky sale del backend |
| `backend/railway.json` | build Dockerfile, `watchPatterns ["/backend/**"]`, `preDeployCommand` con `prisma migrate deploy`, healthcheck `/health` |
| `package.json`, `.husky/`, `lint-staged.config.mjs` | husky en la raíz: pre-commit con lint-staged por subproyecto; pre-push con typecheck y pruebas unitarias del backend (sin Docker) |
| `.github/workflows/{backend,web,dashboard}-ci.yml`, `.github/dependabot.yml` | CI en la raíz (GitHub solo lee `.github/` de la raíz), con filtros `paths` |
| `frontend/web`, `frontend/dashboard` | la API por defecto es `/api` en el mismo origen; el WebSocket se arma con `location`; proxy de Vite hacia el backend en desarrollo |
| `frontend/server.mjs`, `frontend/server/app.mjs` | servidor sin dependencias: estáticos, fallback SPA por app, `/healthz`, proxy `/api` y WebSocket; reescribe `Path=/auth` de la cookie de refresh a `Path=/api/auth` |
| `frontend/Dockerfile`, `frontend/railway.json`, `.dockerignore` | imagen del frontend con contexto en la raíz (necesita `shared/`) |
| `docker-compose.yml` (raíz) | stack completo para probar en local: postgres + backend + frontend (solo el frontend publica puerto) |

## Variables de entorno

### Backend (todas de ejecución)

| Variable | Valor en producción | Notas |
|---|---|---|
| `NODE_ENV` | `production` | Activa la cookie `Secure` |
| `PORT` | `8080` | Fíjalo para que el frontend sepa a qué puerto llamar |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Referencia al servicio de Postgres (red privada) |
| `JWT_ACCESS_SECRET` | 64 hex (`openssl rand -hex 32`) | **Secreto.** Obligatoria |
| `TRUST_PROXY` | `1` | Un salto de confianza: el frontend. Toma la IP del cliente del último `X-Forwarded-For` |
| `COOKIE_SAME_SITE` | `lax` | Mismo origen vía proxy: no hace falta `none` |
| `CORS_ORIGINS` | `https://<dominio>` | También la usa la defensa CSRF (valida `Origin`): debe llevar el dominio público |
| `APP_URL` | `https://<dominio>` | Logos de los correos (`/mail/…`) |
| `PUBLIC_API_URL` | `https://<dominio>/api` | URL del QR en los correos (`/api/tickets/<código>/qr.png`) |
| `PUBLIC_REGISTRATION` | `false` | Sin registro público |
| `PASSWORD_RESET_URL` | `https://<dominio>/dashboard/reset-password` | Solo si se usa el flujo de recuperación |
| `BREVO_API_KEY` | clave de Brevo | **Secreto.** Sin ella los correos solo se escriben en el log |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | remitente verificado en Brevo | |
| `MAX_SEAT_LOCK_TIME` | `15` | Minutos del bloqueo de asiento (plazo de compra) |
| `WEB_IDLE_TIMEOUT_MINUTES` | `2` | Inactividad antes del modal de sesión |
| `MAX_HELD_SEATS_PER_SESSION` | `6` | |
| `IATA_TRM` | `3300` | Pesos por dólar |
| `TAX_PERCENTAGE` | `19` | |
| `BUSINESS_BASE_MULTIPLIER` / `OFFER_DISCOUNT_PERCENTAGE` | `3` / `15` | Reglas de precios (HU5) |
| `BOOKING_TOKEN_EXPIRATION_TIME` / `OUTBOX_MAX_ATTEMPTS` | `45m` / `5` | |
| `LOG_LEVEL`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_EXPIRATION_TIME`, `REFRESH_TOKEN_EXPIRATION_TIME` | los de `backend/.env.example` | Opcionales: tienen valor por defecto |

### Frontend

| Variable | Valor | Cuándo |
|---|---|---|
| `PORT` | la inyecta Railway | ejecución |
| `BACKEND_INTERNAL_URL` | `http://backend.railway.internal:8080` | ejecución. `backend` es el nombre del servicio y `8080` su `PORT`. Sin ella, `/api` responde 503 |
| `VITE_API_URL`, `VITE_DASHBOARD_URL`, `VITE_WEB_URL` | **no definir** | compilación (`ARG` del Dockerfile). Vacías = mismo origen (`/api`, `/dashboard`, `/`) |

### Postgres
Servicio de plantilla de Railway: no requiere configuración. Usa `${{Postgres.DATABASE_URL}}` desde el backend.

## Pasos en Railway

1. **Proyecto → New → Database → PostgreSQL.**
2. **Servicio `backend`** (New → GitHub Repo → este repositorio):
   - Settings → **Root Directory**: `/backend`
   - Settings → **Config as code → Config file path**: `/backend/railway.json`
   - Settings → Networking: **sin dominio público** (solo red privada).
   - Variables: la tabla del backend (`CORS_ORIGINS`, `APP_URL` y `PUBLIC_API_URL` se completan cuando exista el dominio del frontend; el primer deploy puede ir sin ellas).
   - El `preDeployCommand` corre `prisma migrate deploy` antes de cada deploy.
3. **Servicio `frontend`** (New → GitHub Repo → el mismo repositorio):
   - **Sin Root Directory** (el build necesita `frontend/` y `shared/`).
   - Config file path: `/frontend/railway.json` (el `dockerfilePath` es `frontend/Dockerfile`).
   - Variables: `BACKEND_INTERNAL_URL=http://backend.railway.internal:8080`.
   - Settings → Networking → **Generate Domain** (o dominio propio). Ese dominio es el único público.
4. **Vuelve al backend** y fija `CORS_ORIGINS`, `APP_URL` y `PUBLIC_API_URL` con el dominio generado (sin barra final, con `https://`). Redespliega.
5. **Datos iniciales.** La imagen de producción no trae el seed (usa `tsx`):
   - Super admin: `railway run --service backend` no llega a la red privada; usa `railway ssh --service backend` y ahí `ADMIN_PASSWORD=… node dist/cli/create-admin.js --email … --first-name … --last-name …`.
   - Datos de demostración (vuelos, usuarios `admin@lifex.test` y `viewer@lifex.test`): desde tu equipo, con el Postgres en su URL pública (`DATABASE_PUBLIC_URL`): `cd backend && DATABASE_URL=<url pública> npm run db:seed`. No lo hagas en un entorno real con datos.
6. **Comprueba:** `https://<dominio>/healthz`, `https://<dominio>/api/health`, `https://<dominio>/api/config`, el login en `https://<dominio>/dashboard/login` y una compra de punta a punta.

Cada servicio se redespliega solo cuando cambia su carpeta (`watchPatterns`): un cambio en `shared/` redespliega el frontend pero no el backend. Que el contrato se mantenga compatible lo comprueba la CI (la prueba de contrato del backend usa `shared/`).

## Prueba local con Docker Compose

```bash
docker compose up -d --build          # raíz del repo; web en http://localhost:8080, dashboard en /dashboard
# datos de demostración (solo en local): imagen de compilación del backend con tsx
docker build -q --target build -t lifex-backend:build backend
docker run --rm --network lifex-stack_default \
  -e DATABASE_URL=postgresql://app:app@postgres:5432/lifex lifex-backend:build npx tsx prisma/seed.ts
docker compose down                   # (-v borra también la base de datos)
```

Solo el frontend publica puerto; el backend y Postgres quedan en la red interna, igual que en Railway.
Se verificó de punta a punta: login con cookie en el mismo origen y sesión que sobrevive a un refresco, llamadas a la
API por `/api`, WebSocket en `/api/ws`, refresco en `/dashboard/<ruta>` (fallback SPA) y QR en `/api/tickets/<código>/qr.png`.

## Carpetas y ramas obsoletas que recomiendo eliminar (sin borrarlas)

- **`FRONTEND-WEB/`**: recursos de diseño locales (ya fuera del repo, ignorados). Su copia en el historial publicado es
  inofensiva (sin secretos; 44 archivos, 5,9 MB).
- **Ramas `backend`, `frontend/web` y `frontend/dashboard`**: ya están integradas en `main`; se pueden borrar en local
  (`git branch -d`) y en GitHub después del despliegue.
- **Restos del andamiaje del backend**: `backend/README.en.md`, `backend/.scaffold.json` y `backend/docs/` (si ya no
  los necesitas como referencia).
- **`backend/docker-compose.yml`** se queda para desarrollo (y para el humo de la CI); no lo usa Railway.
- **`frontend/dist/`, `frontend/*/node_modules`**: artefactos locales, ya ignorados por git.
