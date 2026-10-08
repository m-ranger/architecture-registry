import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';

const router = express.Router();
const table = 'cluster';

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
    const { name, cluster_type, version, management_address, status, description } = req.body;
    const item = await create(
      table,
      ['name', 'cluster_type', 'version', 'management_address', 'status', 'description'],
      [name, cluster_type, version || null, management_address || null, status, description || null]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, cluster_type, version, management_address, status, description } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['name', 'cluster_type', 'version', 'management_address', 'status', 'description'],
      [name, cluster_type, version || null, management_address || null, status, description || null]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
