import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';

const router = express.Router();
const table = 'environment';

router.get('/', async (req, res, next) => {
  try {
    const items = await getAll(table, 'code ASC');
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
    const { code, name, description, criticality, status } = req.body;
    const item = await create(
      table,
      ['code', 'name', 'description', 'criticality', 'status'],
      [code, name, description || null, criticality || null, status]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, description, criticality, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['code', 'name', 'description', 'criticality', 'status'],
      [code, name, description || null, criticality || null, status]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/environments/:id — удалить среду эксплуатации
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Среда используется экземплярами модулей или сетевыми интерфейсами — сначала удалите их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Среда не найдена' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
