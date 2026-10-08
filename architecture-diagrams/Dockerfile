# ============================================================================
# Модуль «Архитектурные схемы» — отдельный контейнер.
# Этап 1 (build): сборка SPA (React + TypeScript + @xyflow/react, C4).
# Этап 2 (runtime): Node.js — REST API модуля и отдача статики SPA из одного
# контейнера, поэтому модуль не требует изменений в существующем frontend реестра.
# ============================================================================
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Адрес основного приложения реестра — для перехода в карточку объекта (FR-014).
ARG VITE_REGISTRY_URL=http://localhost:8080
ENV VITE_REGISTRY_URL=$VITE_REGISTRY_URL

# Встраивание модуля в общее приложение: префикс статики и клиентских маршрутов
# (`base`) и база API модуля. Значения согласованы с nginx реестра
# (location /diagrams-module/ и /diagrams-api/).
ARG VITE_BASE_PATH=/
ARG VITE_API_BASE=/api
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE=$VITE_API_BASE

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:18-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 3002

CMD ["node", "server/index.js"]
