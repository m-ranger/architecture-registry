/** Русские подписи для журнала изменений и типов модулей — используются на дашборде и в оболочке. */

export const OP_LABEL: Record<string, string> = {
  INSERT: 'Создан',
  UPDATE: 'Изменён',
  DELETE: 'Удалён',
}

export const ENTITY_LABEL: Record<string, string> = {
  information_system: 'Информационная система',
  application_module: 'Модуль',
  module_instance: 'Экземпляр модуля',
  module_deployment: 'Размещение',
  network_interface: 'Сетевой интерфейс',
  information_flow: 'Информационный поток',
  information_flow_project: 'Задействованность потока в проекте',
  server: 'Сервер',
  cluster: 'Кластер',
  network_segment: 'Сетевой сегмент',
  network_zone: 'Сетевая зона',
  router: 'Маршрутизатор',
  firewall: 'Межсетевой экран',
  protocol: 'Протокол',
  environment: 'Среда',
  project: 'Проект',
}

/**
 * Объекты реестра, изменения которых фиксируются в audit_log
 * (полный перечень триггеров — sql/04_audit_triggers.sql).
 */
export const AUDITED_ENTITY_LABEL: Record<string, string> = {
  information_system: ENTITY_LABEL.information_system,
  application_module: ENTITY_LABEL.application_module,
  module_instance: ENTITY_LABEL.module_instance,
  project: ENTITY_LABEL.project,
  information_flow: ENTITY_LABEL.information_flow,
  information_flow_project: ENTITY_LABEL.information_flow_project,
}

/** Русские подписи полей объектов — используются в журнале изменений */
export const FIELD_LABEL: Record<string, string> = {
  id: 'Идентификатор',
  code: 'Код',
  name: 'Наименование',
  description: 'Описание',
  status: 'Статус',
  owner: 'Владелец',
  purpose: 'Назначение',
  module_type: 'Тип модуля',
  version: 'Версия',
  runtime_type: 'Тип исполнения',
  information_system_id: 'Информационная система',
  module_id: 'Модуль',
  environment_id: 'Среда',
  source_module_id: 'Модуль-источник',
  target_module_id: 'Модуль-приёмник',
  protocol_id: 'Протокол',
  target_port: 'Порт',
  valid_from: 'Действует с',
  valid_to: 'Действует по',
  information_flow_id: 'Информационный поток',
  project_id: 'Проект',
  created_at: 'Создан',
  created_by: 'Создал',
  updated_at: 'Изменён',
  updated_by: 'Изменил',
}

/** Подпись поля объекта: русское название или исходное имя колонки */
export const fieldLabel = (key: string) => FIELD_LABEL[key] ?? key

export const MODULE_TYPE_LABEL: Record<string, string> = {
  API: 'API',
  FRONTEND: 'Frontend',
  BATCH: 'Batch',
  DATABASE: 'Базы данных',
  ADAPTER: 'Адаптеры',
  BACKEND: 'Backend',
}
