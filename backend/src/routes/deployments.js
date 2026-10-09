import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import pool from '../db.js';

const router = express.Router();
const table = 'module_deployment';

// GET /api/deployments — список с JOIN на instance, server, cluster
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT md.*, mi.name as instance_name, s.name as server_name, c.name as cluster_name
      FROM module_deployment md
      JOIN module_instance mi ON mi.id = md.module_instance_id
      LEFT JOIN server s ON s.id = md.server_id
      LEFT JOIN cluster c ON c.id = md.cluster_id
      ORDER BY md.deployment_state, mi.name
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
    const { module_instance_id, server_id, cluster_id, deployment_role, deployment_state, valid_from, valid_to } = req.body;
    const item = await create(
      table,
      ['module_instance_id', 'server_id', 'cluster_id', 'deployment_role', 'deployment_state', 'valid_from', 'valid_to'],
      [module_instance_id, server_id || null, cluster_id || null, deployment_role || null, deployment_state, valid_from || null, valid_to || null]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { module_instance_id, server_id, cluster_id, deployment_role, deployment_state, valid_from, valid_to } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['module_instance_id', 'server_id', 'cluster_id', 'deployment_role', 'deployment_state', 'valid_from', 'valid_to'],
      [module_instance_id, server_id || null, cluster_id || null, deployment_role || null, deployment_state, valid_from || null, valid_to || null]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/deployments/:id — удалить размещение
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'На размещение ссылаются зависимые объекты — сначала снимите связи' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Размещение не найдено' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
