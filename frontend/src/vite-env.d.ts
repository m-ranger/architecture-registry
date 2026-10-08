/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Публичный адрес модуля «Архитектурные схемы» (build-arg frontend-сервиса). */
  readonly VITE_DIAGRAMS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
