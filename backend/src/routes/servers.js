import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import { normalizeObjectType } from '../utils/objectType.js';

const router = express.Router();
const table = 'server';

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
    const { name, server_type, status, description, object_type } = req.body;
    const item = await create(
      table,
      ['name', 'server_type', 'status', 'description', 'object_type'],
      [name, server_type || null, status, description || null, normalizeObjectType(object_type)]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/servers/:id — обновить сервер
// Смена типа объекта пересчитывает тип размещений и сетевых адресов сервера
// (триггеры 07_object_types.sql).
router.put('/:id', async (req, res, next) => {
  try {
    const { name, server_type, status, description, object_type } = req.body;
    const columns = ['name', 'server_type', 'status', 'description'];
    const values = [name, server_type || null, status, description || null];
    // Тип меняется только явной передачей поля: запрос без object_type
    // не сбрасывает ранее выбранный EXTERNAL.
    if (object_type !== undefined && object_type !== null && object_type !== '') {
      columns.push('object_type');
      values.push(normalizeObjectType(object_type));
    }

    const item = await update(table, req.params.id, columns, values);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/servers/:id — удалить сервер
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Сервер используется размещениями или сетевыми интерфейсами — сначала удалите их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Сервер не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
