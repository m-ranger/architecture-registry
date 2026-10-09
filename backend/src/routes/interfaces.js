import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import pool from '../db.js';

const router = express.Router();
const table = 'network_interface';

// GET /api/interfaces — список с JOIN на server/router/firewall/cluster, segment и среду
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT ni.*,
        s.name as server_name, r.name as router_name, f.name as firewall_name,
        c.name as cluster_name,
        ns.code as segment_code, nz.code as zone_code,
        e.code as environment_code, e.name as environment_name
      FROM network_interface ni
      LEFT JOIN network_segment ns ON ns.id = ni.network_segment_id
      LEFT JOIN network_zone nz ON nz.id = ns.network_zone_id
      LEFT JOIN environment e ON e.id = ni.environment_id
      LEFT JOIN server s ON s.id = ni.server_id
      LEFT JOIN router r ON r.id = ni.router_id
      LEFT JOIN firewall f ON f.id = ni.firewall_id
      LEFT JOIN cluster c ON c.id = ni.cluster_id
      ORDER BY ni.name ASC
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
    const {
      server_id, router_id, firewall_id, cluster_id, network_segment_id,
      environment_id, name, ip_address, mac_address, interface_role, status,
    } = req.body;
    const item = await create(
      table,
      ['server_id', 'router_id', 'firewall_id', 'cluster_id', 'network_segment_id', 'environment_id', 'name', 'ip_address', 'mac_address', 'interface_role', 'status'],
      [server_id || null, router_id || null, firewall_id || null, cluster_id || null, network_segment_id || null, environment_id || null, name, ip_address || null, mac_address || null, interface_role || null, status]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const {
      server_id, router_id, firewall_id, cluster_id, network_segment_id,
      environment_id, name, ip_address, mac_address, interface_role, status,
    } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['server_id', 'router_id', 'firewall_id', 'cluster_id', 'network_segment_id', 'environment_id', 'name', 'ip_address', 'mac_address', 'interface_role', 'status'],
      [server_id || null, router_id || null, firewall_id || null, cluster_id || null, network_segment_id || null, environment_id || null, name, ip_address || null, mac_address || null, interface_role || null, status]
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/interfaces/:id — удалить сетевой интерфейс
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteById(table, req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'На интерфейс ссылаются зависимые объекты реестра — сначала снимите связи' });
    }
    if (err.message === 'Not found') {
      return res.status(404).json({ error: 'Сетевой интерфейс не найден' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи' });
    }
    next(err);
  }
});

export default router;
