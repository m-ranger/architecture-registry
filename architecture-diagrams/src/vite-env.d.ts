/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый адрес основного приложения реестра — для перехода в карточку объекта (FR-014). */
  readonly VITE_REGISTRY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
