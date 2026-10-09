import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import { currentUser } from '../utils/requestContext.js';
import pool from '../db.js';

const router = express.Router();
const table = 'application_module';

// GET /api/modules — список всех модулей (с JOIN на ИС для удобства фронта)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT am.*, isys.code as is_code, isys.name as is_name
      FROM application_module am
      JOIN information_system isys ON isys.id = am.information_system_id
      ORDER BY am.code ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/modules/:id — один модуль
router.get('/:id', async (req, res, next) => {
  try {
    const item = await getById(table, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/modules — создать модуль
router.post('/', async (req, res, next) => {
  try {
    const { information_system_id, code, name, purpose, module_type, version, status } = req.body;
    const item = await create(
      table,
      ['information_system_id', 'code', 'name', 'purpose', 'module_type', 'version', 'status', 'created_by', 'updated_by'],
      [information_system_id, code, name, purpose, module_type || null, version || null, status, currentUser(), currentUser()]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/modules/:id — обновить модуль
router.put('/:id', async (req, res, next) => {
  try {
    const { information_system_id, code, name, purpose, module_type, version, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['information_system_id', 'code', 'name', 'purpose', 'module_type', 'version', 'status', 'updated_by'],
      [information_system_id, code, name, purpose, module_type || null, version || null, status, currentUser()]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/modules/:id — удалить модуль
// DELETE /api/modules/:id — удалить модуль
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Модуль используется экземплярами или информационными потоками — сначала снимите связи' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Модуль не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
