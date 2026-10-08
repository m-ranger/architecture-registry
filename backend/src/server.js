import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import { requestContext } from './utils/requestContext.js';

// Роуты (создам ниже)
import isRouter from './routes/information-systems.js';
import modulesRouter from './routes/modules.js';
import environmentsRouter from './routes/environments.js';
import instancesRouter from './routes/instances.js';
import deploymentsRouter from './routes/deployments.js';
import serversRouter from './routes/servers.js';
import clustersRouter from './routes/clusters.js';
import zonesRouter from './routes/zones.js';
import segmentsRouter from './routes/segments.js';
import interfacesRouter from './routes/interfaces.js';
import routersRouter from './routes/routers.js';
import firewallsRouter from './routes/firewalls.js';
import protocolsRouter from './routes/protocols.js';
import flowsRouter from './routes/flows.js';
import projectsRouter from './routes/projects.js';
import auditRouter from './routes/audit.js';
import viewsRouter from './routes/views.js';
import reportsRouter from './routes/reports.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
// Пользователь запроса (заголовок X-User) — попадает в created_by/updated_by
// и в автора изменения audit_log.changed_by
app.use(requestContext);


// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// API routes
app.use('/api/information-systems', isRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/environments', environmentsRouter);
app.use('/api/instances', instancesRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/servers', serversRouter);
app.use('/api/clusters', clustersRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/interfaces', interfacesRouter);
app.use('/api/routers', routersRouter);
app.use('/api/firewalls', firewallsRouter);
app.use('/api/protocols', protocolsRouter);
app.use('/api/flows', flowsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/views', viewsRouter);
// Раздел «Отчеты»: сетевые взаимодействия «с какого адреса на какой»
app.use('/api/reports', reportsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Architecture Registry API listening on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing PostgreSQL pool...');
  await pool.end();
  process.exit(0);
});
