import express from 'express';
import { getAll, getById, create, update, deleteById } from '../utils/crud.js';
import pool from '../db.js';

const router = express.Router();
const table = 'network_interface';

// GET /api/interfaces — список с JOIN на server/router/firewall и segment
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT ni.*,
        s.name as server_name, r.name as router_name, f.name as firewall_name,
        ns.code as segment_code, nz.code as zone_code
      FROM network_interface ni
      JOIN network_segment ns ON ns.id = ni.network_segment_id
      JOIN network_zone nz ON nz.id = ns.network_zone_id
      LEFT JOIN server s ON s.id = ni.server_id
      LEFT JOIN router r ON r.id = ni.router_id
      LEFT JOIN firewall f ON f.id = ni.firewall_id
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
    const { server_id, router_id, firewall_id, network_segment_id, name, ip_address, mac_address, interface_role, status } = req.body;
    const item = await create(
      table,
      ['server_id', 'router_id', 'firewall_id', 'network_segment_id', 'name', 'ip_address', 'mac_address', 'interface_role', 'status'],
      [server_id || null, router_id || null, firewall_id || null, network_segment_id, name, ip_address || null, mac_address || null, interface_role || null, status]
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { server_id, router_id, firewall_id, network_segment_id, name, ip_address, mac_address, interface_role, status } = req.body;
    const item = await update(
      table,
      req.params.id,
      ['server_id', 'router_id', 'firewall_id', 'network_segment_id', 'name', 'ip_address', 'mac_address', 'interface_role', 'status'],
      [server_id || null, router_id || null, firewall_id || null, network_segment_id, name, ip_address || null, mac_address || null, interface_role || null, status]
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
