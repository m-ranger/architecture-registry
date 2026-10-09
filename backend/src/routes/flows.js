import express from 'express';
import { deleteById } from '../utils/crud.js';
import { currentUser, withTransaction } from '../utils/requestContext.js';
import pool from '../db.js';

const router = express.Router();
const table = 'information_flow';

/**
 * Полная перезапись набора проектов, в рамках которых задействован поток
 * (information_flow_project, отношение 1:N). Выполняется в транзакции вызова.
 */
async function syncProjects(client, flowId, projectIds) {
  await client.query('DELETE FROM information_flow_project WHERE information_flow_id = $1', [flowId]);
  const ids = Array.isArray(projectIds) ? [...new Set(projectIds.filter(Boolean))] : [];
  for (const projectId of ids) {
    await client.query(
      `INSERT INTO information_flow_project (information_flow_id, project_id, created_by)
       VALUES ($1, $2, $3)`,
      [flowId, projectId, currentUser()]
    );
  }
}

/** Подзапрос «проекты потока» — для списка и карточки */
const PROJECTS_SELECT = `
      COALESCE((
        SELECT json_agg(prj.id ORDER BY prj.code)
        FROM information_flow_project fp JOIN project prj ON prj.id = fp.project_id
        WHERE fp.information_flow_id = fl.id
      ), '[]'::json) AS project_ids,
      COALESCE((
        SELECT json_agg(prj.code ORDER BY prj.code)
        FROM information_flow_project fp JOIN project prj ON prj.id = fp.project_id
        WHERE fp.information_flow_id = fl.id
      ), '[]'::json) AS project_codes`;

// GET /api/flows — список с JOIN на source/target modules, protocol и проектами
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT fl.*,
        sm.code as source_module_code, sm.name as source_module_name,
        tm.code as target_module_code, tm.name as target_module_name,
        p.code as protocol_code, p.name as protocol_name,
        ${PROJECTS_SELECT}
      FROM information_flow fl
      JOIN application_module sm ON sm.id = fl.source_module_id
      JOIN application_module tm ON tm.id = fl.target_module_id
      JOIN protocol p ON p.id = fl.protocol_id
      ORDER BY fl.code ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/flows/:id — карточка потока вместе с задействованными проектами
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT fl.*, ${PROJECTS_SELECT}
      FROM information_flow fl
      WHERE fl.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/flows — создать поток вместе с набором проектов (одна транзакция)
router.post('/', async (req, res, next) => {
  try {
    const { code, name, source_module_id, target_module_id, protocol_id, target_port, description, status, valid_from, valid_to, project_ids } = req.body;
    const item = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO information_flow
           (code, name, source_module_id, target_module_id, protocol_id, target_port, description, status, valid_from, valid_to, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [code, name, source_module_id, target_module_id, protocol_id, target_port || null, description || null, status, valid_from || null, valid_to || null, currentUser(), currentUser()]
      );
      await syncProjects(client, rows[0].id, project_ids);
      return rows[0];
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/flows/:id — изменить поток (набор проектов перезаписывается в той же транзакции)
router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, source_module_id, target_module_id, protocol_id, target_port, description, status, valid_from, valid_to, project_ids } = req.body;
    const item = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE information_flow SET
           code = $1, name = $2, source_module_id = $3, target_module_id = $4, protocol_id = $5,
           target_port = $6, description = $7, status = $8, valid_from = $9, valid_to = $10, updated_by = $11
         WHERE id = $12
         RETURNING *`,
        [code, name, source_module_id, target_module_id, protocol_id, target_port || null, description || null, status, valid_from || null, valid_to || null, currentUser(), req.params.id]
      );
      if (rows.length === 0) throw Object.assign(new Error('Not found'), { status: 404 });
      // Набор проектов перезаписывается только если поле передано в запросе
      if (Array.isArray(project_ids)) await syncProjects(client, req.params.id, project_ids);
      return rows[0];
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flows/:id — удалить информационный поток
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'На поток ссылаются зависимые объекты — сначала снимите связи' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Информационный поток не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
