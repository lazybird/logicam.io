import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { organizationsRouter } from './routes/organizations.js';
import { fleetRouter } from './routes/fleet.js';
import { adminRouter } from './routes/admin.js';
import type { AuthContextVariables } from './auth/middleware.js';

export const app = new Hono<{ Variables: AuthContextVariables }>();

// CORS & Middleware utilitaires
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'logicam-api',
    timestamp: new Date().toISOString(),
  });
});

// Montage des routeurs de l'API
app.route('/api/auth', authRouter);
app.route('/api/organizations', organizationsRouter);
app.route('/api/fleet', fleetRouter);
app.route('/api/admin', adminRouter);
