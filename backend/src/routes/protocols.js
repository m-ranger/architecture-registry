import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';

const router = express.Router();
const table = 'protocol';

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
    const { code, name, transport, layer, default_port, description, status } = req.body;
    const item = await create(
      table,
      ['code', 'name', 'transport', 'layer', 'default_port', 'description', 'status'],
      [code, name, transport || null, layer || null, default_port || null, description || null, status]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, transport, layer, default_port, description, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['code', 'name', 'transport', 'layer', 'default_port', 'description', 'status'],
      [code, name, transport || null, layer || null, default_port || null, description || null, status]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/protocols/:id — удалить протокол
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Протокол используется информационными потоками — сначала удалите или переназначьте их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Протокол не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
