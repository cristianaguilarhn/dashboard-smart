import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import reasignacionRoutes from './routes/reasignacion.routes.js';

const app = express();
const port = Number(process.env.PORT || 4000);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origen no permitido por CORS.'));
    },
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'dashboard-smart-secure-server' });
});

app.use('/api/dashboard', reasignacionRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    ok: false,
    message: error.message || 'Error interno del backend seguro.',
  });
});

app.listen(port, () => {
  console.log(`Dashboard SMART secure server listening on port ${port}`);
});
