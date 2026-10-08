import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Сборка SPA модуля «Архитектурные схемы».
 * В production статика отдаётся тем же Node-сервисом (server/index.js),
 * в dev-режиме /api проксируется на локальный API модуля (порт 3002).
 *
 * `VITE_BASE_PATH` позволяет встроить модуль в общее приложение реестра:
 * при сборке через docker-compose задаётся `/diagrams-module/`, и тогда SPA
 * модуля открывается по адресу реестра (nginx проксирует префикс) — без второй
 * вкладки и без CORS. По умолчанию base остаётся корневым (`/`), поэтому
 * прямой доступ к модулю на его порту и `npm run dev:web` не меняются.
 */
const base = (process.env.VITE_BASE_PATH || '/').replace(/\/*$/, '/')

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Разделение вендоров: canvas-редактор тяжелее остальных частей SPA.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          xyflow: ['@xyflow/react'],
        },
      },
    },
  },
  server: {
    port: 5183,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
