import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/views/:viewName — универсальный доступ к 14 представлениям из 02_views.sql
 * Доступные представления:
 *   v01_is_modules, v02_module_instances, v03_deployments_on_servers,
 *   v04_deployments_on_clusters, v05_information_flow_matrix,
 *   v06_module_incoming, v07_module_outgoing, v08_server_composition,
 *   v09_segment_composition, v10_zone_composition, v11_network_interfaces,
 *   v12_architecture_changes, v13_flow_projects, v14_project_flows
 */

const allowedViews = [
  'v01_is_modules',
  'v02_module_instances',
  'v03_deployments_on_servers',
  'v04_deployments_on_clusters',
  'v05_information_flow_matrix',
  'v06_module_incoming',
  'v07_module_outgoing',
  'v08_server_composition',
  'v09_segment_composition',
  'v10_zone_composition',
  'v11_network_interfaces',
  'v12_architecture_changes',
  'v13_flow_projects',
  'v14_project_flows',
];

router.get('/:viewName', async (req, res, next) => {
  try {
    const { viewName } = req.params;
    if (!allowedViews.includes(viewName)) {
      return res.status(404).json({ error: `View ${viewName} not found or not allowed` });
    }
    const { rows } = await pool.query(`SELECT * FROM ${viewName}`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
