import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import pool from '../db.js';

const router = express.Router();
const table = 'network_zone';

// GET /api/zones — список зон с parent_code для удобства фронта
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT nz.*, pz.code as parent_code, pz.name as parent_name
      FROM network_zone nz
      LEFT JOIN network_zone pz ON pz.id = nz.parent_id
      ORDER BY nz.code ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await getById(table, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { code, name, zone_type, security_level, parent_id, description, status } = req.body;
    const item = await create(
      table,
      ['code', 'name', 'zone_type', 'security_level', 'parent_id', 'description', 'status'],
      [code, name, zone_type || null, security_level || null, parent_id || null, description || null, status]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, zone_type, security_level, parent_id, description, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['code', 'name', 'zone_type', 'security_level', 'parent_id', 'description', 'status'],
      [code, name, zone_type || null, security_level || null, parent_id || null, description || null, status]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/zones/:id — удалить сетевую зону
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Зона используется подчинёнными зонами или сегментами — сначала удалите их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Зона не найдена' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
