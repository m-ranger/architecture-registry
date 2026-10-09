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
| §10 Правила генерации | три генератора: System Context (агрегация между ИС), Container (модули ИС + внешние ИС), Deployment (контуры → узлы размещения → экземпляры): экземпляры укладываются внутрь рамки своего узла, а рамка узла расширяется под состав (см. «Узлы размещения и их состав») |
| §11 UI/UX | верхний тулбар, левая палитра и поиск реестра, canvas React Flow, правая панель свойств, нижняя строка статуса, панель «Потоки области», `Ctrl+S / Delete / Ctrl+Z / Ctrl+Y`, мультивыбор |
| §12 API | `GET/POST /api/diagrams`, `GET/PUT/DELETE /api/diagrams/{id}`, `/generate`, `/flows`, `/validate`, `/publish`, `/versions`, `/versions/{no}`, `/export`, `/api/registry/*` |
| §13 Автогенерация и sync | `mode=REBUILD` (перестраивает layout) и `mode=SYNC` (сохраняет ручные координаты) |
| §14 Раскладка | `server/layout.js` — слоистый layout; локальная раскладка на клиенте (`src/layout/layoutService.ts`); ручные координаты не перезаписываются без явного действия |
| §15 Экспорт | `server/exporter.js` (SVG, PlantUML, Mermaid, JSON) + `src/export/exportService.ts` (PNG/PDF из того же серверного SVG) |
| §16 RBAC | `server/index.js` — матрица ADMIN / ARCHITECT / ANALYST / OWNER / OBSERVER, проверка на backend, `403` при отсутствии права |
| §17 Валидация | `server/validate.js` — существование registry ref, соответствие C4-типу, endpoints связей, статус и порт потока, протокол, loopback, циклы иерархии, RETIRED-объекты, изолированные узлы, состав узлов размещения (`INSTANCE_OUTSIDE_NODE`, `INSTANCE_WITHOUT_NODE`, `NODE_FRAME_COLLAPSED`) |
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

## Сетевые адреса развертывания и срез по среде

Схема **Deployment** отвечает на вопрос «с какого адреса на какой адрес выполняется
информационный поток», поэтому адрес развертывания — часть диаграммы:

* **адрес узла размещения** — `network_interface`: владелец `server_id` — адрес
  сервера (роль `interface_role`: `SERVICE`, `MANAGEMENT`, ...), владелец
  `cluster_id` — адрес кластера, роль в кластере `interface_role`: `INGRESS`
  (точка входа), `NODE` (узел), `MANAGEMENT` (управление); среда адреса —
  `environment_id` (не задана — адрес действует во всех средах узла);
* **узел размещения** (`server`/`cluster`) показывает свои адреса, а **узел размещения
  экземпляра** (`module_deployment`) — адреса узла, на котором размещен: если экземпляр
  развернут на нескольких серверах, узлов столько же, сколько размещений, и у каждого
  свой адрес;
* **подпись связи** — `адрес:порт → адрес:порт` по предпочтительным адресам сторон
  (приоритет роли: `SERVICE` → `INGRESS` → `VIRTUAL` → `NODE` → `MANAGEMENT` → прочие).

### Срез схемы по среде

Диаграмму развертывания можно построить в разрезе одной среды (тест, прод и т. п.) —
для каждого проекта отдельная схема на каждую среду:

* у схемы есть поле `architecture_diagram.scope_environment_id` (`NULL` — все среды);
* в списке схем реестра среда выбирается при создании схемы типа Deployment, в
  редакторе модуля — селектором «Среда» на панели инструментов
  (`PATCH /api/diagrams/{id}/slice`; после смены среза граф перестраивается по реестру);
* в схему попадают размещения экземпляров выбранной среды, а на узлах показываются
  адреса этой среды и «общие» адреса узла (`environment_id IS NULL`).


### Проверки и экспорт

Проверки схемы развертывания (`POST /api/diagrams/{id}/validate`):

* `DEPLOYMENT_ADDRESS_MISSING` (WARNING) — у узла размещения нет ни одного адреса;
* `ENVIRONMENT_SLICE_MISMATCH` (ERROR) — размещение относится к другой среде, чем срез схемы;
* `EDGE_ADDRESS_UNRESOLVED` (WARNING) — в подписи связи нет адресов «откуда → куда».

Экспорт (`SVG`, `PlantUML`, `Mermaid`, `JSON`) выводит адреса в узлах и подписях
связей, поэтому выгрузка отвечает на тот же вопрос, что и canvas.

### Пример: схема развертывания проекта в разрезе среды

```bash
# 1. Справочник сред для выбора среза
curl "http://localhost:8082/api/registry/environments"

# 2. Схема развертывания проекта A24-8394 в разрезе среды PROD
curl -X POST http://localhost:8082/api/diagrams \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"ARCH-PRJ-A24-8394-DEPLOY-PROD\",\"name\":\"Проект A24-8394 — Deployment (PROD)\",\"diagramType\":\"DEPLOYMENT\",\"scopeType\":\"project\",\"scopeObjectId\":\"<PROJECT-UUID>\",\"environmentId\":\"<ENV-UUID>\"}"

# 3. Смена среза: схема перестраивается по данным реестра
curl -X PATCH http://localhost:8082/api/diagrams/ARCH-PRJ-A24-8394-DEPLOY-PROD/slice \
  -H "Content-Type: application/json" -d "{\"environmentId\":\"<ENV-UUID>\"}"
```

Чтобы адреса попали и в подписи связей, модули обеих сторон потока должны иметь
размещения в одной и той же среде (`module_deployment` + `module_instance.environment_id`)
и у узлов размещения должны быть заведены адреса (`network_interface` с владельцем
`server_id` или `cluster_id`).

### Панель «Потоки области»

Связи на canvas строятся только между размещениями выбранного среза, поэтому поток,
у которого контрагент не развернут в среде, на схеме не отображается. Чтобы такие
потоки не терялись, в редакторе есть панель **«Потоки области»** (кнопка в строке
статуса, счётчик — число потоков вне среза):

* `GET /api/diagrams/{id}/flows` — `server/scopeFlows.js` возвращает все потоки области
  схемы (проекта или информационной системы) с признаком попадания в срез;
* для каждой стороны показываются модуль, ИС, экземпляр, среда, узел размещения и
  адрес (`host(network_interface.ip_address)`); если размещения или адреса нет —
  сторона помечается «нет размещений в срезе» / «адрес не зарегистрирован»;
* `edgeIds` — идентификаторы связей графа, образованных потоком (`dep:{размещение
  источника}->{размещение приёмника}`), кнопка «Показать» фокусирует связь на canvas;
* `reason` — причина, по которой поток не отражён на схеме («Контрагент не развернут в
  среде PROD: NFS/NFS», «Ни одна сторона не развернута в среде PROD», «Связь удалена
  со схемы»); кнопка «Реестр» открывает карточку потока в основном приложении;
* идентификаторы связей считает та же функция `flowDeploymentEdges` (`server/graph.js`),
  что и генератор схемы развертывания, поэтому панель и canvas всегда согласованы.

```bash
# Потоки области схемы: что попало в срез, что осталось вне него
curl "http://localhost:8082/api/diagrams/ARCH-PRJ-A24-8394-DEPLOY-PROD/flows"
```

Пример ответа для проекта A24-8394 со срезом PROD (в реестре развернут только
`runner`, поэтому `inSlice = false`, а причина указана у каждого потока):

```json
{
  "scope": { "type": "project", "code": "A24-8394", "environmentCode": "PROD" },
  "summary": { "total": 4, "inSlice": 0, "outOfSlice": 4, "onCanvas": 0 },
  "flows": [
    { "code": "NFS-3", "inSlice": false, "edgeIds": [],
      "reason": "Контрагент не развернут в среде PROD: CRYPT/CRYPT1" }
  ]
}
```

Отчёт «Сетевые взаимодействия» (раздел «Отчеты» основного приложения) отвечает на
тот же вопрос в табличном виде: «с какого адреса на какой» по всем потокам реестра
(`GET /api/reports/network-interactions`, см. `docs/reports-network-interactions-v1.0.md`).


## Узлы размещения и их состав (схема развертывания)

Схема развертывания читается по уровням C4: **контур среды → узел размещения →
экземпляр модуля**. Узел размещения (`server` / `cluster`, C4 `DeploymentNode`) —
контейнер: он расширяется под свой состав, а все его экземпляры
(`module_deployment`, C4 `DeploymentInstance`) находятся внутри его рамки.

Правило одно и то же на всех уровнях модуля — `server/layout.js` (генератор,
нормализация, экспорт) и `src/layout/layoutService.ts` (canvas и локальная
раскладка):

| Что | Как считается |
| --- | --- |
| рамка узла размещения | `max(типовой размер C4, состав + отступ 16 px)`; растёт вправо и вниз, а позиция узла остаётся ручной координатой пользователя (ТЗ §14) |
| «шапка» узла | 84 px: название, технология, адреса развёртывания, счётчик состава, статус |
| экземпляры | сетка внутри рамки: до 3 экземпляров — одна колонка («стойка»), дальше — 2–3 колонки, чтобы узел не вытягивался в бесконечную полосу |
| узел без состава | типовой размер 270 × 120 — как у пустого узла C4 |

Поведение в редакторе:

* узел размещения перетаскивается вместе со своим составом, а экземпляр не может
  выйти за «шапку» и левую границу узла — рамка растягивается за ним;
* удаление узла размещения снимает и его экземпляры (состав узла — часть узла);
* экземпляр, перенесённый внутрь рамки другого узла, меняет узел размещения
  автоматически; то же самое — селектом «Узел размещения» на панели свойств;
* кнопка «Авто-раскладка» (`localLayout`) раскладывает узлы по контурам сред и
  укладывает экземпляры внутрь узлов, не перезаписывая состав вручную;
* инвариант соблюдается и на сервере: `writeGraph` нормализует состав при
  сохранении, поэтому в хранилище не бывает экземпляров вне узла размещения.

Валидация (`server/validate.js`, `src/validation/diagramValidator.ts`) сообщает о
нарушении инварианта — так выглядит схема, сохранённая до этих правил:

| Код | Уровень | Что обнаружено |
| --- | --- | --- |
| `INSTANCE_OUTSIDE_NODE` | WARNING | экземпляр выходит за рамку своего узла размещения |
| `INSTANCE_WITHOUT_NODE` | WARNING | у экземпляра нет узла размещения |
| `NODE_FRAME_COLLAPSED` | INFO | рамка узла не растянута под состав |

Экспорт отвечает тем же правилам: `SVG` рисует рамку узла с шапкой и составом
внутри (шапка непрозрачная, тело — полупрозрачное, чтобы связи между
экземплярами внутри узла оставались видимыми), `PlantUML` и `Mermaid` вкладывают
экземпляры в блок узла размещения.

Проверка на живых данных реестра:

```bash
# Схема развертывания перестраивается по данным реестра: состав укладывается в узлы
curl -X POST http://localhost:8082/api/diagrams/di1/generate \
  -H "Content-Type: application/json" -H "x-user-role: ARCHITECT" -d "{\"mode\":\"REBUILD\"}"

# Каждый экземпляр лежит внутри рамки своего узла размещения
curl -s http://localhost:8082/api/diagrams/di1 -H "x-user-role: ARCHITECT" | node -e "
let raw='';process.stdin.on('data',(d)=>raw+=d).on('end',()=>{
  const nodes=JSON.parse(raw).graph.nodes, by=new Map(nodes.map((n)=>[n.id,n]));
  for (const n of nodes) {
    if (n.c4Type!=='DeploymentInstance') continue;
    const p=by.get(n.parent);
    const inside = n.position.x>=p.position.x && n.position.y>=p.position.y &&
      n.position.x+n.size.width<=p.position.x+p.size.width &&
      n.position.y+n.size.height<=p.position.y+p.size.height;
    console.log(n.name, 'внутри', p.name, inside);
  }
});"
```

Ожидаемый вывод — по строке на экземпляр, все `true`.

