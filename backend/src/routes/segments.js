import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import pool from '../db.js';

const router = express.Router();
const table = 'network_segment';

// GET /api/segments — список с JOIN на zone
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT ns.*, nz.code as zone_code, nz.name as zone_name
      FROM network_segment ns
      JOIN network_zone nz ON nz.id = ns.network_zone_id
      ORDER BY ns.code ASC
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
    const { network_zone_id, code, name, cidr, vlan, purpose, status } = req.body;
    const item = await create(
      table,
      ['network_zone_id', 'code', 'name', 'cidr', 'vlan', 'purpose', 'status'],
      [network_zone_id, code, name, cidr || null, vlan || null, purpose || null, status]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { network_zone_id, code, name, cidr, vlan, purpose, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['network_zone_id', 'code', 'name', 'cidr', 'vlan', 'purpose', 'status'],
      [network_zone_id, code, name, cidr || null, vlan || null, purpose || null, status]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/segments/:id — удалить сетевой сегмент
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Сегмент используется сетевыми интерфейсами — сначала удалите или переназначьте их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Сегмент не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
