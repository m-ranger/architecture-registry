import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import pool from '../db.js';

const router = express.Router();
const table = 'module_instance';

// GET /api/instances — список с JOIN на module и environment
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT mi.*, am.code as module_code, am.name as module_name, env.code as env_code, env.name as env_name
      FROM module_instance mi
      JOIN application_module am ON am.id = mi.module_id
      JOIN environment env ON env.id = mi.environment_id
      ORDER BY mi.name ASC
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
    const { module_id, environment_id, name, version, runtime_type, status, description } = req.body;
    const item = await create(
      table,
      ['module_id', 'environment_id', 'name', 'version', 'runtime_type', 'status', 'description'],
      [module_id, environment_id, name, version || null, runtime_type || null, status, description || null]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { module_id, environment_id, name, version, runtime_type, status, description } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['module_id', 'environment_id', 'name', 'version', 'runtime_type', 'status', 'description'],
      [module_id, environment_id, name, version || null, runtime_type || null, status, description || null]
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
