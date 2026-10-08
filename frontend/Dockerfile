# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Публичный адрес модуля «Архитектурные схемы» (сервис diagrams) для пункта меню.
ARG VITE_DIAGRAMS_URL=http://localhost:8082
ENV VITE_DIAGRAMS_URL=$VITE_DIAGRAMS_URL

COPY . .
RUN npm run build

# Production stage
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
