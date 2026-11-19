# syntax=docker/dockerfile:1
# Contexto de build: la RAÍZ del repositorio (necesita shared/ y frontend/).
#   docker build -f frontend/Dockerfile .

FROM node:24-slim AS build
WORKDIR /app

# Dependencias primero (capas cacheables). shared/ son fuentes TypeScript que importan zod: necesita las suyas.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --prefix shared
COPY frontend/package.json frontend/package-lock.json frontend/
COPY frontend/web/package.json frontend/web/package-lock.json frontend/web/
COPY frontend/dashboard/package.json frontend/dashboard/package-lock.json frontend/dashboard/
RUN npm ci --prefix frontend \
  && npm ci --prefix frontend/web \
  && npm ci --prefix frontend/dashboard

COPY shared shared
COPY frontend frontend

# Variables de compilación (opcionales). Vacías = mismo origen: API en /api, panel en /dashboard, web en /.
ARG VITE_API_URL=""
ARG VITE_DASHBOARD_URL=""
ARG VITE_WEB_URL=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_DASHBOARD_URL=$VITE_DASHBOARD_URL \
    VITE_WEB_URL=$VITE_WEB_URL
# Compila la web y el dashboard y los junta en frontend/dist (web en "/", dashboard en "/dashboard").
RUN npm --prefix frontend run build

# Imagen final: solo el build y el servidor (sin dependencias de npm), sin privilegios.
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/dist ./dist
COPY --chown=node:node frontend/server.mjs ./server.mjs
COPY --chown=node:node frontend/server/app.mjs ./server/app.mjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.mjs"]
