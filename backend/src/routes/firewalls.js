import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';

const router = express.Router();
const table = 'firewall';

router.get('/', async (req, res, next) => {
  try {
    const items = await getAll(table, 'name ASC');
    res.json(items);
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
    const { name, firewall_type, vendor, model, management_address, status, description } = req.body;
    const item = await create(
      table,
      ['name', 'firewall_type', 'vendor', 'model', 'management_address', 'status', 'description'],
      [name, firewall_type || null, vendor || null, model || null, management_address || null, status, description || null]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, firewall_type, vendor, model, management_address, status, description } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['name', 'firewall_type', 'vendor', 'model', 'management_address', 'status', 'description'],
      [name, firewall_type || null, vendor || null, model || null, management_address || null, status, description || null]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/firewalls/:id — удалить межсетевой экран
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Межсетевой экран используется сетевыми интерфейсами — сначала удалите их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Межсетевой экран не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
