import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import { currentUser } from '../utils/requestContext.js';
import { normalizeObjectType } from '../utils/objectType.js';

const router = express.Router();
const table = 'information_system';

// GET /api/information-systems — список всех ИС
router.get('/', async (req, res, next) => {
  try {
    const items = await getAll(table, 'code ASC');
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/information-systems/:id — одна ИС
router.get('/:id', async (req, res, next) => {
  try {
    const item = await getById(table, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/information-systems — создать ИС
router.post('/', async (req, res, next) => {
  try {
    const { code, name, description, status, owner, object_type } = req.body;
    const item = await create(
      table,
      ['code', 'name', 'description', 'status', 'owner', 'object_type', 'created_by', 'updated_by'],
      [code, name, description || null, status, owner || null, normalizeObjectType(object_type), currentUser(), currentUser()]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/information-systems/:id — обновить ИС
// Смена типа объекта пересчитывает тип модулей этой ИС (триггеры 07_object_types.sql).
router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, description, status, owner, object_type } = req.body;
    const columns = ['code', 'name', 'description', 'status', 'owner'];
    const values = [code, name, description || null, status, owner || null];
    // Тип меняется только явной передачей поля: запрос без object_type
    // не сбрасывает ранее выбранный EXTERNAL.
    if (object_type !== undefined && object_type !== null && object_type !== '') {
      columns.push('object_type');
      values.push(normalizeObjectType(object_type));
    }
    columns.push('updated_by');
    values.push(currentUser());

    const item = await update(table, req.params.id, columns, values);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/information-systems/:id — удалить ИС
// DELETE /api/information-systems/:id — удалить ИС
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    // 23503 — на запись ещё ссылаются зависимые объекты (FK объявлены ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Информационная система используется модулями — сначала удалите или перенесите их' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Информационная система не найдена' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
