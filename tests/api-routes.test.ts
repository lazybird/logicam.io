import { describe, it, expect } from 'vitest';
import { app } from '../src/server/app.js';

describe('Hono API Routes & Multi-Tenant Security', () => {
  it('GET /api/health returns 200 OK', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('logicam-api');
  });

  it('GET /api/auth/demo-accounts returns 4 default demo accounts', async () => {
    const res = await app.request('/api/auth/demo-accounts');
    expect(res.status).toBe(200);
    const accounts = await res.json();
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBe(4);
    expect(accounts.map((a: any) => a.role)).toContain('SUPER_ADMIN');
    expect(accounts.map((a: any) => a.role)).toContain('ORG_ADMIN');
    expect(accounts.map((a: any) => a.role)).toContain('MEMBER');
  });

  it('POST /api/auth/login rejects empty payload with 400', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/fleet rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/fleet');
    expect(res.status).toBe(401);
  });

  it('GET /api/fleet/drivers rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/fleet/drivers');
    expect(res.status).toBe(401);
  });

  it('GET /api/organizations rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/organizations');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/overview rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/admin/overview');
    expect(res.status).toBe(401);
  });
});
