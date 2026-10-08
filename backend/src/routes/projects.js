import express from 'express';
import { getById, create, update, deleteById } from '../utils/crud.js';
import { currentUser } from '../utils/requestContext.js';
import pool from '../db.js';

const router = express.Router();
const table = 'project';

/** Обязательные параметры проекта: Номер проекта (code) и Наименование (name) */
function missingParams(body) {
  const missing = [];
  if (!body.code) missing.push('Номер проекта');
  if (!body.name) missing.push('Наименование');
  if (!body.status) missing.push('Статус');
  return missing;
}

/**
 * Проект — объект архитектурного реестра.
 * Обязательные параметры: Номер проекта (code) и Наименование (name).
 * Потоки задействуются в проектах через information_flow_project (1:N).
 */

// GET /api/projects — список проектов с количеством задействованных потоков
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT prj.*, count(fp.information_flow_id)::int AS flows_cnt
      FROM project prj
      LEFT JOIN information_flow_project fp ON fp.project_id = prj.id
      GROUP BY prj.id
      ORDER BY prj.code ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/flows — потоки, задействованные в проекте
router.get('/:id/flows', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT fl.*,
        sm.code as source_module_code, sm.name as source_module_name,
        tm.code as target_module_code, tm.name as target_module_name,
        p.code as protocol_code, p.name as protocol_name
      FROM information_flow_project fp
      JOIN information_flow fl ON fl.id = fp.information_flow_id
      JOIN application_module sm ON sm.id = fl.source_module_id
      JOIN application_module tm ON tm.id = fl.target_module_id
      JOIN protocol p ON p.id = fl.protocol_id
      WHERE fp.project_id = $1
      ORDER BY fl.code ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id — карточка проекта
router.get('/:id', async (req, res, next) => {
  try {
    const item = await getById(table, req.params.id);
    res.json(item);
  } catch (err) {
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
    }
    next(err);
  }
});

// POST /api/projects — создать проект
router.post('/', async (req, res, next) => {
  try {
    const missing = missingParams(req.body);
    if (missing.length) {
      return res.status(400).json({ error: `Не заполнены обязательные параметры проекта: ${missing.join(', ')}` });
    }
    const { code, name, description, status } = req.body;
    const item = await create(
      table,
      ['code', 'name', 'description', 'status', 'created_by', 'updated_by'],
      [code, name, description || null, status, currentUser(), currentUser()]
    );
    res.status(201).json(item);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Проект с номером «${req.body.code}» уже существует` });
    }
    next(err);
  }
});

// PUT /api/projects/:id — обновить проект
router.put('/:id', async (req, res, next) => {
  try {
    const missing = missingParams(req.body);
    if (missing.length) {
      return res.status(400).json({ error: `Не заполнены обязательные параметры проекта: ${missing.join(', ')}` });
    }
    const { code, name, description, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['code', 'name', 'description', 'status', 'updated_by'],
      [code, name, description || null, status, currentUser()]
    );
    res.json(item);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Проект с номером «${req.body.code}» уже существует` });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
    }
    next(err);
  }
});

// DELETE /api/projects/:id — удалить проект (запрещено, пока он задействован в потоках)
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Проект задействован в информационных потоках — сначала снимите связи' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
    }
    next(err);
  }
});

export default router;
