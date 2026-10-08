import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import pool from './db.js';
import { migrate } from './migrate.js';
import * as diagrams from './diagrams.js';
import { generateGraph } from './graph.js';
import { validateGraph } from './validate.js';
import { exportDiagram, EXPORT_FORMATS } from './exporter.js';
import {
  searchRegistry,
  getRegistryObject,
  getSystemFlows,
  listSystems,
  listProjects,
  REGISTRY_TYPES,
} from './registry.js';

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const PORT = parseInt(process.env.PORT || '3002', 10);

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  }),
);
app.use(express.json({ limit: process.env.JSON_LIMIT || '8mb' }));

/**
 * RBAC (ТЗ §16). Проверка прав выполняется на backend (FR-016).
 * Роль передаётся корпоративным IAM; в контейнере — заголовком x-user-role.
 */
const ROLE_PERMISSIONS = {
  ADMIN: { view: true, edit: true, publish: true, export: true },
  ARCHITECT: { view: true, edit: true, publish: true, export: true },
  // Системный аналитик: публикация — «по праву», в базовой матрице выключена.
  ANALYST: { view: true, edit: true, publish: false, export: true },
  OWNER: { view: true, edit: false, publish: false, export: true },
  OBSERVER: { view: true, edit: false, publish: false, export: true },
};

app.use((req, res, next) => {
  const header = req.header('x-user-role') || process.env.DEFAULT_ROLE || 'ARCHITECT';
  req.role = String(header).toUpperCase();
  req.userId = req.header('x-user-id') || process.env.MODULE_USER || 'diagram-module';
  next();
});

const requirePermission = (permission) => (req, res, next) => {
  const permissions = ROLE_PERMISSIONS[req.role] || ROLE_PERMISSIONS.OBSERVER;
  if (!permissions[permission]) {
    return res.status(403).json({
      error: `Недостаточно прав: роль ${req.role} не имеет права «${permission}»`,
    });
  }
  return next();
};

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// ---------------------------------------------------------------------------
// Служебные эндпоинты
// ---------------------------------------------------------------------------
app.get(
  '/health',
  asyncRoute(async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', module: 'architecture-diagrams', database: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
    }
  }),
);

app.get('/api/meta', (req, res) => {
  res.json({
    module: 'architecture-diagrams',
    version: '1.0.0',
    diagramTypes: ['SYSTEM_CONTEXT', 'CONTAINER', 'DEPLOYMENT'],
    exportFormats: EXPORT_FORMATS,
    registryTypes: REGISTRY_TYPES,
    role: req.role,
    permissions: ROLE_PERMISSIONS[req.role] || ROLE_PERMISSIONS.OBSERVER,
  });
});

// ---------------------------------------------------------------------------
// Registry API (ТЗ §12: /api/registry/*)
// ---------------------------------------------------------------------------
app.get(
  '/api/registry/systems',
  asyncRoute(async (req, res) => {
    res.json(await listSystems(String(req.query.q || '')));
  }),
)

/**
 * Проекты реестра — для выбора области схемы «в разрезе проекта»
 * (все информационные потоки проекта и участвующие в них модули).
 */
app.get(
  '/api/registry/projects',
  asyncRoute(async (req, res) => {
    res.json(await listProjects(String(req.query.q || '')));
  }),
);

app.get(
  '/api/registry/search',
  asyncRoute(async (req, res) => {
    const types = req.query.types
      ? String(req.query.types)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : REGISTRY_TYPES;
    res.json(await searchRegistry(String(req.query.q || ''), types, Number(req.query.limit) || 20));
  }),
);

app.get(
  '/api/registry/flows',
  asyncRoute(async (req, res) => {
    const systemId = req.query.systemId;
    if (!systemId) return res.status(400).json({ error: 'Параметр systemId обязателен' });
    res.json(await getSystemFlows(String(systemId)));
  }),
);

app.get(
  '/api/registry/objects/:type/:id',
  asyncRoute(async (req, res) => {
    const object = await getRegistryObject(req.params.type, req.params.id);
    if (!object) return res.status(404).json({ error: 'Объект реестра не найден' });
    res.json(object);
  }),
);

// ---------------------------------------------------------------------------
// Diagrams API (ТЗ §12)
// ---------------------------------------------------------------------------
app.get(
  '/api/diagrams',
  requirePermission('view'),
  asyncRoute(async (req, res) => {
    res.json(await diagrams.listDiagrams());
  }),
);

app.post(
  '/api/diagrams',
  requirePermission('edit'),
  asyncRoute(async (req, res) => {
    const created = await diagrams.createDiagram(req.body || {});
    // FR-002: начальный граф формируется по данным реестра — по ИС или по проекту.
    if (req.body?.generate !== false && created.scopeObjectId) {
      const graph = await generateGraph({
        diagramType: created.diagramType,
        scopeId: created.scopeObjectId,
        scopeType: created.scopeType,
        mode: 'REBUILD',
      });
      await diagrams.applyGeneratedGraph(created.id, graph);
    }
    res.status(201).json(await diagrams.getDiagramGraph(created.id));
  }),
);

app.get(
  '/api/diagrams/:id',
  requirePermission('view'),
  asyncRoute(async (req, res) => {
    res.json(await diagrams.getDiagramGraph(req.params.id));
  }),
);

app.put(
  '/api/diagrams/:id',
  requirePermission('edit'),
  asyncRoute(async (req, res) => {
    const { graph, revision } = req.body || {};
    if (!graph) return res.status(400).json({ error: 'Тело запроса должно содержать graph' });
    const diagram = await diagrams.saveGraph(req.params.id, graph, revision ?? null);
    res.json({ diagram, graph });
  }),
);

app.delete(
  '/api/diagrams/:id',
  requirePermission('edit'),
  asyncRoute(async (req, res) => {
    res.json(await diagrams.deleteDiagram(req.params.id));
  }),
);

app.post(
  '/api/diagrams/:id/generate',
  requirePermission('edit'),
  asyncRoute(async (req, res) => {
    const { diagram: current, graph: currentGraph } = await diagrams.getDiagramGraph(req.params.id);
    const existingPositions = {};
    for (const node of currentGraph.nodes) existingPositions[node.id] = node.position;

    const graph = await generateGraph({
      diagramType: current.diagramType,
      scopeId: current.scopeObjectId,
      scopeType: current.scopeType,
      mode: String(req.body?.mode || 'REBUILD').toUpperCase(),
      existingPositions,
    });
    const diagram = await diagrams.applyGeneratedGraph(req.params.id, graph);
    res.json({ diagram, graph });
  }),
);

app.post(
  '/api/diagrams/:id/validate',
  requirePermission('view'),
  asyncRoute(async (req, res) => {
    const { diagram, graph } = await diagrams.getDiagramGraph(req.params.id);
    res.json(await validateGraph(graph, { published: diagram.status === 'PUBLISHED' }));
  }),
);

app.post(
  '/api/diagrams/:id/publish',
  requirePermission('publish'),
  asyncRoute(async (req, res) => {
    const { graph } = await diagrams.getDiagramGraph(req.params.id);
    const validation = await validateGraph(graph, { published: false });
    if (!validation.canPublish) {
      return res.status(422).json({
        error: 'Публикация заблокирована: обнаружены ERROR-ы валидации',
        validation,
      });
    }
    const published = await diagrams.publishDiagram(req.params.id);
    res.json({ diagram: published.diagram, versionNo: published.versionNo, validation });
  }),
);

app.get(
  '/api/diagrams/:id/versions',
  requirePermission('view'),
  asyncRoute(async (req, res) => {
    res.json(await diagrams.listVersions(req.params.id));
  }),
);

app.get(
  '/api/diagrams/:id/versions/:versionNo',
  requirePermission('view'),
  asyncRoute(async (req, res) => {
    res.json(await diagrams.getVersion(req.params.id, req.params.versionNo));
  }),
);

app.post(
  '/api/diagrams/:id/versions/:versionNo/restore',
  requirePermission('edit'),
  asyncRoute(async (req, res) => {
    const version = await diagrams.getVersion(req.params.id, req.params.versionNo);
    const graph = {
      schemaVersion: '1.0',
      nodes: version.snapshot?.nodes || [],
      edges: version.snapshot?.edges || [],
    };
    const diagram = await diagrams.saveGraph(req.params.id, graph, req.body?.revision ?? null);
    res.json({ diagram, graph });
  }),
);

app.get(
  '/api/diagrams/:id/export',
  requirePermission('export'),
  asyncRoute(async (req, res) => {
    const { diagram, graph } = await diagrams.getDiagramGraph(req.params.id);
    const format = String(req.query.format || 'json');
    const result = exportDiagram(format, graph, {
      id: diagram.id,
      code: diagram.code,
      name: diagram.name,
      diagramType: diagram.diagramType,
      version: diagram.publishedVersion ?? diagram.revision,
      status: diagram.status,
    });

    if (String(req.query.inline || '') === '1') {
      res.type(result.contentType).send(result.body);
      return;
    }
    const filename = `${diagram.code}-v${diagram.publishedVersion ?? diagram.revision}.${result.extension}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.type(result.contentType).send(result.body);
  }),
);

// ---------------------------------------------------------------------------
// Статика SPA модуля и обработка ошибок
// ---------------------------------------------------------------------------
/**
 * Префикс, под которым SPA модуля встроена в общее приложение реестра:
 * nginx сервиса `frontend` проксирует /diagrams-module/ на этот сервис, а
 * сборка модуля выполняется с тем же значением (build-arg VITE_BASE_PATH),
 * поэтому статика и клиентские маршруты совпадают с префиксом.
 * Прямой доступ к модулю на его собственном порту при этом сохраняется.
 */
const APP_BASE = (process.env.APP_BASE || '/diagrams-module').replace(/\/+$/, '');

if (existsSync(distDir)) {
  const indexHtml = join(distDir, 'index.html');

  // Встроенный режим: статика и SPA-fallback по префиксу общего приложения.
  app.use(APP_BASE, express.static(distDir, { index: false }));
  app.get([APP_BASE, `${APP_BASE}/*`], (req, res) => res.sendFile(indexHtml));

  // Прямой режим (отдельный порт модуля): корень и SPA-fallback без префикса.
  app.use(express.static(distDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });
}

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[diagrams] API error:', err);
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Старт сервиса: идемпотентная миграция слоя диаграмм с повторами,
 * чтобы контейнер поднимался даже при медленном старте СУБД.
 */
async function start() {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await migrate();
      break;
    } catch (err) {
      console.error(`[diagrams] migration attempt ${attempt} failed: ${err.message}`);
      if (attempt === 5) console.error('[diagrams] migration will be retried on demand');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  app.listen(PORT, () => {
    console.log(`Architecture Diagrams module listening on http://localhost:${PORT}`);
    console.log(`SPA dist: ${existsSync(distDir) ? distDir : 'не собрана (режим разработки)'}`);
  });
}

start();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing PostgreSQL pool...');
  await pool.end();
  process.exit(0);
});


