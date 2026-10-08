# Модуль «Архитектурные схемы» (Architecture Diagrams)

Отдельный модуль визуализации архитектуры для Единого архитектурного реестра.
Реализован как **самостоятельный контейнер**: Node.js-сервис отдаёт и REST API модуля,
и собранное SPA (React + TypeScript + `@xyflow/react`), и хранит диаграммный слой в
существующей СУБД реестра.

Ключевое решение ТЗ §29: **Registry as Source of Truth, Diagram as View**.

Модуль является частью общего проекта: исходники лежат в `architecture-diagrams/`
рядом с `backend/`, `frontend/`, `sql/`, а сервис `diagrams` поднимается тем же
`docker-compose.yml`.

## Состав контейнера

| Слой | Реализация |
| --- | --- |
| Canvas / UX | React 18 + TypeScript + `@xyflow/react` (React Flow), antd 5 |
| Backend модуля | Node 18 + Express 4 + `pg` |
| Нотация | C4: System Context / Container / Deployment |
| Хранение | PostgreSQL (существующая СУБД реестра) + JSON snapshot версий |
| Экспорт | SVG · PNG · PDF · PlantUML/C4-PlantUML · Mermaid · JSON |
| Auth/RBAC | проверка прав на backend по роли (матрица ТЗ §16) |

## Соответствие требованиям ТЗ

| Раздел ТЗ | Реализация |
| --- | --- |
| §6 C4 mapping | `server/graph.js`: `information_system → SoftwareSystem`, `application_module → Container`, `module_instance → DeploymentInstance`, `server/cluster → DeploymentNode`, `environment → EnvironmentBoundary`, `information_flow → Relationship`, `protocol → technology` |
| §7, §8 Модель данных | `server/schema.sql`: `architecture_diagram`, `architecture_diagram_element`, `architecture_diagram_relationship`, `diagram_version` |
| §9 FR-001…FR-018 | создание, автогенерация, редактирование, registry refs, потоки, поиск, аннотации, фильтры типа, layout, атомарное сохранение, версии, публикация, экспорт, навигация в реестр, валидация, RBAC, audit-поля, sync |
| §10 Правила генерации | три генератора: System Context (агрегация между ИС), Container (модули ИС + внешние ИС), Deployment (контуры → узлы → экземпляры) |
| §11 UI/UX | верхний тулбар, левая палитра и поиск реестра, canvas React Flow, правая панель свойств, нижняя строка статуса, `Ctrl+S / Delete / Ctrl+Z / Ctrl+Y`, мультивыбор |
| §12 API | `GET/POST /api/diagrams`, `GET/PUT/DELETE /api/diagrams/{id}`, `/generate`, `/validate`, `/publish`, `/versions`, `/versions/{no}`, `/export`, `/api/registry/*` |
| §13 Автогенерация и sync | `mode=REBUILD` (перестраивает layout) и `mode=SYNC` (сохраняет ручные координаты) |
| §14 Раскладка | `server/layout.js` — слоистый layout; локальная раскладка на клиенте (`src/layout/layoutService.ts`); ручные координаты не перезаписываются без явного действия |
| §15 Экспорт | `server/exporter.js` (SVG, PlantUML, Mermaid, JSON) + `src/export/exportService.ts` (PNG/PDF из того же серверного SVG) |
| §16 RBAC | `server/index.js` — матрица ADMIN / ARCHITECT / ANALYST / OWNER / OBSERVER, проверка на backend, `403` при отсутствии права |
| §17 Валидация | `server/validate.js` — существование registry ref, соответствие C4-типу, endpoints связей, статус и порт потока, протокол, loopback, циклы иерархии, RETIRED-объекты, изолированные узлы |
| §18 Версии и публикация | `Draft → Validation → Published → Archived`; опубликованный snapshot неизменяем; правки возвращают схему в Draft; флаг «есть изменения зависимостей» |
| §20 НФТ | bulk-вставка чанками по 100 узлов/связей, транзакционное сохранение, пакетная проверка ссылок |
| §22 Структура frontend | `src/api`, `src/model`, `src/editor`, `src/nodes`, `src/edges`, `src/layout`, `src/validation`, `src/export` |

## Важное расхождение с текстом ТЗ

ТЗ писалось против модели, где `information_flow` связан с `module_instance`, а контур
называется `environment_contour`. Фактический `sql/01_ddl.sql` v2.0 описывает:

* `information_flow` — связь **на уровне `application_module`** (`source_module_id` / `target_module_id`),
  без привязки к экземплярам;
* контур среды — таблица **`environment`** (а не `environment_contour`), а принадлежность
  экземпляра модуля среде хранится в `module_instance.environment_id`;
* размещение экземпляра на узле описывается отдельной таблицей `module_deployment`.

Как это учтено в модуле:

* **System Context** — связи между ИС агрегируются из потоков между их модулями;
* **Container** — контейнеры (модули ИС) строятся напрямую из `information_flow` между модулями,
  протокол и порт выводятся на связь;
* **Deployment** — границы контуров берутся из `environment`, узлы размещения — из
  `module_deployment`, связи между экземплярами агрегируются из потоков уровня модулей.

## Границы реализации (осознанные ограничения)

* **Доступ к реестру.** Модуль читает нормализованную модель реестра напрямую из PostgreSQL
  (`server/registry.js`) и не изменяет её (ТЗ §19). Собственный «Registry / API Layer» модуля
  (`/api/registry/*`) отдаёт поиск, потоки и карточки объектов. Существующий backend реестра
  при этом не является runtime-зависимостью модуля, поэтому контейнер поднимается независимо
  и не требует синхронных REST-вызовов при генерации схем (десятки запросов на одну схему
  выполняются одним соединением с БД).
* **PNG и PDF** формируются на клиенте из серверного SVG (растеризация в canvas и печать в PDF
  через диалог браузера). Причина — не добавлять в контейнер тяжёлые headless-рендереры;
  семантика при этом берётся из серверной модели, а не из canvas (ТЗ §15).
* **Component и Dynamic** схемы не реализованы: соответствующих сущностей и сценарной модели
  в реестре ещё нет (рекомендация ТЗ §29 — следующая очередь).
* **Импорт PlantUML/Structurizr** не реализован (ТЗ §28 — решение перед разработкой).
* Диаграммный слой создаётся самим сервисом при старте, поэтому менять `sql/01_ddl.sql`
  и образ БД не требуется: модуль самодостаточен.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PORT` | `3002` | порт API и SPA внутри контейнера |
| `POSTGRES_HOST` | `localhost` | хост СУБД (`db` в compose) |
| `POSTGRES_PORT` | `5432` | порт СУБД |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `architecture_registry` / `registry_admin` / `registry_pass` | доступ к реестру |
| `CORS_ORIGIN` | — | разрешённые источники (список через запятую) |
| `DEFAULT_ROLE` | `ARCHITECT` | роль по умолчанию, если IAM не передал заголовок |
| `MODULE_USER` | `diagram-module` | значение `created_by` / `updated_by` |
| `VITE_REGISTRY_URL` (build-arg) | `http://localhost:8080` | адрес основного приложения реестра для перехода в карточку объекта |
| `APP_BASE` | `/diagrams-module` | префикс, по которому сервис отдаёт SPA модуля при встраивании в общее приложение (nginx реестра проксирует этот префикс) |
| `VITE_BASE_PATH` (build-arg) | `/` | база сборки SPA (`base`): префикс статики и клиентских маршрутов; в compose задаётся `/diagrams-module/` |
| `VITE_API_BASE` (build-arg) | `/api` | база API для клиента модуля; в compose задаётся `/diagrams-api` (прокси того же origin, что и реестр) |
| `JSON_LIMIT` | `8mb` | максимальный размер тела запроса сохранения схемы |

## Интеграция с основным приложением

Помимо отдельного контейнера модуль встроен в общий проект:

* исходники модуля лежат в корне проекта — `architecture-diagrams/` (рядом с `backend/`, `frontend/`, `sql/`);
* сервис `diagrams` описан в общем `docker-compose.yml` и поднимается вместе со стеком
  (`docker compose up -d`), health-check — `GET /health`;
* у схемы две области (scope): **информационная система** (модули ИС и потоки с её
  участием) и **проект** (все информационные потоки проекта и все модули,
  участвующие в проекте через эти интеграционные потоки) — вариант выбирается в
  диалоге создания схемы («Область схемы»);
* в главном меню реестра есть пункт **«Архитектурные схемы»**, который открывает
  **список схем внутри общего приложения** (маршрут `/diagrams`) — таблица, KPI,
  фильтры, карточка схемы и создание новой схемы работают в оболочке реестра;
* nginx сервиса `frontend` проксирует модуль на том же origin
  (`location /diagrams-api/` → API модуля, `location /diagrams-module/` → SPA модуля),
  поэтому открытие списка и редактора не требует второй вкладки и CORS;
* встраивание задаётся build-args `VITE_BASE_PATH=/diagrams-module/` и
  `VITE_API_BASE=/diagrams-api` (плюс `APP_BASE` для сервера модуля), значения
  по умолчанию (`/` и `/api`) сохраняют прямой доступ на порту модуля;
* из списка доступны выгрузки схемы (SVG/PlantUML/Mermaid/JSON) и резервная
  ссылка «в отдельном окне» на порт `DIAGRAMS_PUBLIC_URL`;
* модуль читает данные того же экземпляра PostgreSQL (`db`), что и остальной реестр, и
  создаёт собственный диаграммный слой при старте, не изменяя существующие таблицы.

## Запуск

```bash
# весь стек, включая модуль схем
docker compose up -d --build

# только модуль (при уже поднятых db и backend)
docker compose up -d --build diagrams
```

Модуль: <http://localhost:8082> · API: <http://localhost:8082/api/diagrams> ·
health: <http://localhost:8082/health>

## Разработка

```bash
cd architecture-diagrams
npm install
npm run dev:server   # API модуля на :3002
npm run dev:web      # Vite на :5183, /api проксируется на :3002
npm run typecheck
npm run build
```

## Проверка API (примеры из Приложения Б ТЗ)

```bash
curl -X POST http://localhost:8082/api/diagrams \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"ARCH-IS-001-CONTAINER\",\"name\":\"Интеграционная система - Container\",\"diagramType\":\"CONTAINER\",\"scopeType\":\"information_system\",\"scopeObjectId\":\"<IS-UUID>\"}"

# Область схемы «проект»: в схему попадают все информационные потоки проекта и все
# модули, участвующие в проекте через эти интеграционные потоки
curl "http://localhost:8082/api/registry/projects"
curl -X POST http://localhost:8082/api/diagrams \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"ARCH-PRJ-001-CONTAINER\",\"name\":\"Проект - Container\",\"diagramType\":\"CONTAINER\",\"scopeType\":\"project\",\"scopeObjectId\":\"<PROJECT-UUID>\"}"

curl -X POST http://localhost:8082/api/diagrams/ARCH-IS-001-CONTAINER/validate
curl -X POST http://localhost:8082/api/diagrams/ARCH-IS-001-CONTAINER/publish -H "Content-Type: application/json" -d "{}"
curl "http://localhost:8082/api/diagrams/ARCH-IS-001-CONTAINER/export?format=plantuml"
```

Заголовок `x-user-role` управляет правами: `ARCHITECT` (полные), `ANALYST` (без публикации),
`OWNER` и `OBSERVER` (просмотр и экспорт).
