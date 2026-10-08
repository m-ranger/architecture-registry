import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import { currentUser } from '../utils/requestContext.js';

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
    const { code, name, description, status, owner } = req.body;
    const item = await create(
      table,
      ['code', 'name', 'description', 'status', 'owner', 'created_by', 'updated_by'],
      [code, name, description || null, status, owner || null, currentUser(), currentUser()]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/information-systems/:id — обновить ИС
router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, description, status, owner } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['code', 'name', 'description', 'status', 'owner', 'updated_by'],
      [code, name, description || null, status, owner || null, currentUser()]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/information-systems/:id — удалить ИС
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
